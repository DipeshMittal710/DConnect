import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField } from '@mui/material';
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import server from '../environment';

const server_url = server;

const REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥'];

var connections = {};

const peerConfigConnections = {
    "iceServers": [{ "urls": "stun:stun.l.google.com:19302" }]
}

export default function VideoMeetComponent() {

    var socketRef          = useRef();
    let socketIdRef        = useRef();
    let localVideoref      = useRef();
    let timerRef           = useRef(null);
    const analysersRef     = useRef({});
    const speakingInterval = useRef(null);

    // ── existing states ────────────────────────────────────────────────────
    let [videoAvailable,  setVideoAvailable]  = useState(true);
    let [audioAvailable,  setAudioAvailable]  = useState(true);
    let [video,           setVideo]           = useState([]);
    let [audio,           setAudio]           = useState();
    let [screen,          setScreen]          = useState();
    let [showModal,       setModal]           = useState(true);
    let [screenAvailable, setScreenAvailable] = useState();
    let [messages,        setMessages]        = useState([]);
    let [message,         setMessage]         = useState("");
    let [newMessages,     setNewMessages]     = useState(3);
    let [askForUsername,  setAskForUsername]  = useState(true);
    let [username,        setUsername]        = useState("");
    const videoRef = useRef([]);
    let [videos, setVideos] = useState([]);

    // ── navbar states ──────────────────────────────────────────────────────
    let [callDuration, setCallDuration] = useState(0);
    let [isConnected,  setIsConnected]  = useState(false);
    let [inviteCopied, setInviteCopied] = useState(false);
    let [showSettings, setShowSettings] = useState(false);

    // ── feature states (speaking / toasts / hand / reactions) ─────────────
    let [speaking,        setSpeaking]        = useState({});
    let [toasts,          setToasts]          = useState([]);
    let [handRaised,      setHandRaised]      = useState(false);
    let [raisedHands,     setRaisedHands]     = useState({});
    let [showReactions,   setShowReactions]   = useState(false);
    let [activeReactions, setActiveReactions] = useState([]);

    // ── NEW: lobby device toggle states ───────────────────────────────────
    let [lobbyVideoOn, setLobbyVideoOn] = useState(true);
    let [lobbyAudioOn, setLobbyAudioOn] = useState(true);

    // ── FIXED: runs once on mount ──────────────────────────────────────────
    useEffect(() => {
        console.log("HELLO");
        getPermissions();
    }, []);

    // ── cleanup on unmount ─────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (timerRef.current)           clearInterval(timerRef.current);
            if (speakingInterval.current)   clearInterval(speakingInterval.current);
            Object.values(analysersRef.current).forEach(({ audioCtx }) => {
                try { audioCtx.close(); } catch (e) {}
            });
        };
    }, []);

    // ── speaking detection polling ─────────────────────────────────────────
    useEffect(() => {
        speakingInterval.current = setInterval(() => {
            const dataArray = new Uint8Array(128);
            const next = {};
            for (const [id, { analyser }] of Object.entries(analysersRef.current)) {
                try {
                    analyser.getByteFrequencyData(dataArray);
                    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                    next[id] = avg > 15;
                } catch (e) {}
            }
            setSpeaking(prev => {
                const changed =
                    Object.keys(next).length !== Object.keys(prev).length ||
                    Object.entries(next).some(([k, v]) => prev[k] !== v);
                return changed ? next : prev;
            });
        }, 100);
        return () => clearInterval(speakingInterval.current);
    }, []);

    // ── watch remote videos → start/stop analysers ────────────────────────
    useEffect(() => {
        videos.forEach(v => {
            if (v.stream && !analysersRef.current[v.socketId])
                startSpeakingDetection(v.socketId, v.stream);
        });
        Object.keys(analysersRef.current).forEach(id => {
            if (id !== 'local' && !videos.find(v => v.socketId === id)) {
                try { analysersRef.current[id].audioCtx.close(); } catch (e) {}
                delete analysersRef.current[id];
            }
        });
    }, [videos]);

    // ── helpers ────────────────────────────────────────────────────────────
    const startSpeakingDetection = (socketId, stream) => {
        try {
            if (analysersRef.current[socketId]) return;
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            audioCtx.createMediaStreamSource(stream).connect(analyser);
            analysersRef.current[socketId] = { audioCtx, analyser };
        } catch (e) { console.log('Speaking detection error:', e); }
    };

    const addToast = (msg, type = 'join') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    };

    const handleRaiseHand = () => {
        const next = !handRaised;
        setHandRaised(next);
        if (socketRef.current)
            socketRef.current.emit('chat-message', `__HAND__:${next}`, username);
        if (next) addToast('You raised your hand ✋', 'hand');
    };

    const triggerReaction = (emoji) => {
        const id = Date.now() + Math.random();
        const x  = 20 + Math.random() * 60;
        setActiveReactions(prev => [...prev, { id, emoji, x }]);
        setTimeout(() => setActiveReactions(prev => prev.filter(r => r.id !== id)), 3200);
    };

    const sendReaction = (emoji) => {
        if (socketRef.current)
            socketRef.current.emit('chat-message', `__REACTION__:${emoji}`, username);
        triggerReaction(emoji);
        setShowReactions(false);
    };

    // ── NEW: lobby device toggles ──────────────────────────────────────────

    const toggleLobbyVideo = () => {
        if (window.localStream) {
            const tracks = window.localStream.getVideoTracks();
            const nextState = !lobbyVideoOn;
            tracks.forEach(t => { t.enabled = nextState; });
            setLobbyVideoOn(nextState);
        }
    };

    const toggleLobbyAudio = () => {
        if (window.localStream) {
            const tracks = window.localStream.getAudioTracks();
            const nextState = !lobbyAudioOn;
            tracks.forEach(t => { t.enabled = nextState; });
            setLobbyAudioOn(nextState);
        }
    };

    // ──────────────────────────────────────────────────────────────────────

    let getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .then((stream) => { })
                    .catch((e) => console.log(e))
            }
        }
    }

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoPermission) { setVideoAvailable(true);  console.log('Video permission granted'); }
            else                 { setVideoAvailable(false); console.log('Video permission denied');  }

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioPermission) { setAudioAvailable(true);  console.log('Audio permission granted'); }
            else                 { setAudioAvailable(false); console.log('Audio permission denied');  }

            if (navigator.mediaDevices.getDisplayMedia) setScreenAvailable(true);
            else                                         setScreenAvailable(false);

            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) localVideoref.current.srcObject = userMediaStream;
                }
            }
        } catch (error) { console.log(error); }
    };

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();
            console.log("SET STATE HAS ", video, audio);
        }
    }, [video, audio])

    // MODIFIED: respects lobby device states when joining
    let getMedia = () => {
        setVideo(lobbyVideoOn && videoAvailable);
        setAudio(lobbyAudioOn && audioAvailable);
        connectToSocketServer();
    }

    let getUserMediaSuccess = (stream) => {
        try { window.localStream.getTracks().forEach(track => track.stop()) }
        catch (e) { console.log(e) }

        window.localStream = stream;
        localVideoref.current.srcObject = stream;

        if (analysersRef.current['local']) {
            try { analysersRef.current['local'].audioCtx.close(); } catch (e) {}
            delete analysersRef.current['local'];
        }
        startSpeakingDetection('local', stream);

        for (let id in connections) {
            if (id === socketIdRef.current) continue
            connections[id].addStream(window.localStream)
            connections[id].createOffer().then((description) => {
                console.log(description)
                connections[id].setLocalDescription(description)
                    .then(() => { socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription })) })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false); setAudio(false);
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }
            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream
            for (let id in connections) {
                connections[id].addStream(window.localStream)
                connections[id].createOffer().then((description) => {
                    connections[id].setLocalDescription(description)
                        .then(() => { socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription })) })
                        .catch(e => console.log(e))
                })
            }
        })
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .then((stream) => { })
                .catch((e) => console.log(e))
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
        }
    }

    let getDislayMediaSuccess = (stream) => {
        console.log("HERE")
        try { window.localStream.getTracks().forEach(track => track.stop()) }
        catch (e) { console.log(e) }
        window.localStream = stream
        localVideoref.current.srcObject = stream
        for (let id in connections) {
            if (id === socketIdRef.current) continue
            connections[id].addStream(window.localStream)
            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => { socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription })) })
                    .catch(e => console.log(e))
            })
        }
        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false)
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }
            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream
            getUserMedia()
        })
    }

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)
        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }
            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }

    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false })
        socketRef.current.on('signal', gotMessageFromServer)
        socketRef.current.on('disconnect', () => { setIsConnected(false); });
        socketRef.current.on('connect', () => {
            setIsConnected(true);
            socketRef.current.emit('join-call', window.location.href)
            socketIdRef.current = socketRef.current.id
            socketRef.current.on('chat-message', addMessage)
            socketRef.current.on('user-left', (id) => {
                addToast('A participant left', 'leave');
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
            })
            socketRef.current.on('user-joined', (id, clients) => {
                if (id !== socketIdRef.current) addToast('A participant joined', 'join');
                clients.forEach((socketListId) => {
                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections)
                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null)
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                    }
                    connections[socketListId].onaddstream = (event) => {
                        console.log("BEFORE:", videoRef.current);
                        console.log("FINDING ID: ", socketListId);
                        let videoExists = videoRef.current.find(video => video.socketId === socketListId);
                        if (videoExists) {
                            console.log("FOUND EXISTING");
                            setVideos(videos => {
                                const updatedVideos = videos.map(video =>
                                    video.socketId === socketListId ? { ...video, stream: event.stream } : video
                                );
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        } else {
                            console.log("CREATING NEW");
                            let newVideo = { socketId: socketListId, stream: event.stream, autoplay: true, playsinline: true };
                            setVideos(videos => {
                                const updatedVideos = [...videos, newVideo];
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        }
                    };
                    if (window.localStream !== undefined && window.localStream !== null) {
                        connections[socketListId].addStream(window.localStream)
                    } else {
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                        window.localStream = blackSilence()
                        connections[socketListId].addStream(window.localStream)
                    }
                })
                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue
                        try { connections[id2].addStream(window.localStream) } catch (e) {}
                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => { socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription })) })
                                .catch(e => console.log(e))
                        })
                    }
                }
            })
        })
    }

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start(); ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }

    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let handleVideo  = () => { setVideo(!video); }
    let handleAudio  = () => { setAudio(!audio); }
    let handleScreen = () => { setScreen(!screen); }

    useEffect(() => {
        if (screen !== undefined) getDislayMedia();
    }, [screen])

    let handleEndCall = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        Object.values(analysersRef.current).forEach(({ audioCtx }) => {
            try { audioCtx.close(); } catch (e) {}
        });
        analysersRef.current = {};
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) {}
        window.location.href = "/"
    }

    let openChat  = () => { setModal(true);  setNewMessages(0); }
    let closeChat = () => { setModal(false); }
    let handleMessage = (e) => { setMessage(e.target.value); }

    const addMessage = (data, sender, socketIdSender) => {
        if (data.startsWith('__HAND__:')) {
            if (socketIdSender !== socketIdRef.current) {
                const isRaised = data.split(':')[1] === 'true';
                setRaisedHands(prev => ({ ...prev, [socketIdSender]: isRaised }));
                if (isRaised) addToast(`${sender} raised their hand ✋`, 'hand');
            }
            return;
        }
        if (data.startsWith('__REACTION__:')) {
            if (socketIdSender !== socketIdRef.current) triggerReaction(data.split(':')[1]);
            return;
        }
        setMessages((prevMessages) => [
            ...prevMessages,
            {
                sender: sender, data: data,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
        ]);
        if (socketIdSender !== socketIdRef.current)
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
    };

    let sendMessage = () => {
        console.log(socketRef.current);
        socketRef.current.emit('chat-message', message, username)
        setMessage("");
    }

    let connect = () => {
        setAskForUsername(false);
        getMedia();
        timerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    }

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const getRoomName = () => {
        const parts = window.location.pathname.split('/');
        return parts[parts.length - 1] || 'Meeting';
    };

    const handleInvite = () => {
        navigator.clipboard.writeText(window.location.href);
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
    };

    const darkFieldSx = {
        flex: 1,
        '& .MuiOutlinedInput-root': {
            color: '#fff', borderRadius: '12px',
            '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
            '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
        },
        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' },
        '& .MuiInputLabel-root.Mui-focused': { color: '#3b82f6' },
    };

    const lobbyFieldSx = {
        width: '100%',
        '& .MuiOutlinedInput-root': {
            color: '#fff', borderRadius: '10px',
            '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
            '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
        },
        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
        '& .MuiInputLabel-root.Mui-focused': { color: '#3b82f6' },
    };

    const toggleBtnSx = (active) => ({
        borderRadius: '9px', py: 0.85,
        textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.2s',
        ...(active ? {
            background: '#3b82f6', color: '#fff',
            boxShadow: '0 2px 10px rgba(59,130,246,0.4)',
            '&:hover': { background: '#2563eb' },
        } : {
            color: 'rgba(255,255,255,0.45)',
            '&:hover': { background: 'rgba(255,255,255,0.07)', color: '#fff' },
        }),
    });

    // ─────────────────────────────────────────────────────────────────────

    return (
        <div>

            {askForUsername === true ?

                /* ── LOBBY ─────────────────────────────────────────────────────── */
                <div className={styles.lobbyContainer}>
                    <div className={styles.lobbyCard}>

                        <div className={styles.lobbyBrand}>
                            <h1>DConnect</h1>
                            <p>HD video calls, right in your browser</p>
                        </div>

                        {/* Camera preview */}
                        <div className={styles.lobbyPreview}>
                            <video ref={localVideoref} autoPlay muted></video>

                            {/* NEW: camera-off overlay */}
                            {!lobbyVideoOn && (
                                <div className={styles.lobbyVideoOffOverlay}>
                                    <VideocamOffIcon sx={{ fontSize: '2.8rem', color: 'rgba(255,255,255,0.35)' }} />
                                    <p>Camera is off</p>
                                </div>
                            )}
                        </div>

                        {/* NEW: mic / camera toggle row */}
                        <div className={styles.lobbyDeviceRow}>

                            <button
                                onClick={toggleLobbyVideo}
                                className={`${styles.lobbyDeviceBtn} ${!lobbyVideoOn ? styles.lobbyDeviceBtnOff : ''}`}
                            >
                                {lobbyVideoOn
                                    ? <VideocamIcon sx={{ fontSize: '1.15rem' }} />
                                    : <VideocamOffIcon sx={{ fontSize: '1.15rem' }} />
                                }
                                <span>{lobbyVideoOn ? 'Camera On' : 'Camera Off'}</span>
                            </button>

                            <button
                                onClick={toggleLobbyAudio}
                                className={`${styles.lobbyDeviceBtn} ${!lobbyAudioOn ? styles.lobbyDeviceBtnOff : ''}`}
                            >
                                {lobbyAudioOn
                                    ? <MicIcon sx={{ fontSize: '1.15rem' }} />
                                    : <MicOffIcon sx={{ fontSize: '1.15rem' }} />
                                }
                                <span>{lobbyAudioOn ? 'Mic On' : 'Mic Off'}</span>
                            </button>

                        </div>

                        {/* Name + join */}
                        <div className={styles.lobbyForm}>
                            <TextField
                                label="Your display name"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && username.trim() && connect()}
                                variant="outlined"
                                sx={lobbyFieldSx}
                            />
                            <Button
                                variant="contained"
                                onClick={connect}
                                disabled={!username.trim()}
                                fullWidth
                                sx={{
                                    mt: 1.5, py: 1.5,
                                    background: '#3b82f6',
                                    '&:hover': { background: '#2563eb' },
                                    '&.Mui-disabled': { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.25)' },
                                    borderRadius: '10px', fontSize: '1rem', fontWeight: 600,
                                    textTransform: 'none', letterSpacing: 0, boxShadow: 'none',
                                }}
                            >
                                {/* show what devices will be active when joining */}
                                Join Now
                                {(!lobbyVideoOn || !lobbyAudioOn) && (
                                    <span className={styles.joinHint}>
                                        {!lobbyVideoOn && !lobbyAudioOn ? ' · No cam, no mic' :
                                         !lobbyVideoOn ? ' · No camera' : ' · Muted'}
                                    </span>
                                )}
                            </Button>
                        </div>

                    </div>
                </div>

            :

                /* ── MEETING ROOM ───────────────────────────────────────────────── */
                <div className={styles.meetVideoContainer}>

                    {/* NAVBAR */}
                    <div className={styles.navbar}>
                        <div className={styles.navLeft}>
                            <span className={styles.navBrand}>DConnect</span>
                            <span className={styles.navRoom}>Room: {getRoomName()}</span>
                        </div>
                        <div className={styles.navCenter}>
                            <span className={styles.navStatus}>
                                <span className={isConnected ? styles.dotConnected : styles.dotConnecting}></span>
                                {isConnected ? 'Connected' : 'Connecting...'}
                            </span>
                            <span className={styles.navDivider}>|</span>
                            <span className={styles.navTimer}>{formatTime(callDuration)}</span>
                        </div>
                        <div className={styles.navRight}>
                            <span className={styles.navParticipants}>
                                👥 {videos.length + 1} Participant{videos.length + 1 !== 1 ? 's' : ''}
                            </span>
                            <button className={`${styles.navBtn} ${inviteCopied ? styles.navBtnCopied : ''}`} onClick={handleInvite}>
                                {inviteCopied ? '✓ Copied!' : 'Invite'}
                            </button>
                            <button className={`${styles.navBtn} ${showSettings ? styles.navBtnActive : ''}`} onClick={() => setShowSettings(!showSettings)}>
                                ⚙ Settings
                            </button>
                        </div>
                    </div>

                    {/* TOASTS */}
                    <div className={styles.toastContainer}>
                        {toasts.map(toast => (
                            <div key={toast.id} className={`${styles.toast} ${styles[`toast_${toast.type}`] || ''}`}>
                                {toast.type === 'join'  && <span className={styles.toastDot} style={{ background: '#22c55e' }}></span>}
                                {toast.type === 'leave' && <span className={styles.toastDot} style={{ background: '#ef4444' }}></span>}
                                {toast.type === 'hand'  && <span style={{ marginRight: 6 }}>✋</span>}
                                {toast.msg}
                            </div>
                        ))}
                    </div>

                    {/* CHAT PANEL */}
                    {showModal &&
                        <div className={styles.chatRoom}>
                            <div className={styles.chatContainer}>
                                <div className={styles.chatHeader}>
                                    <span className={styles.chatTitle}>Chat</span>
                                    <button className={styles.chatCloseBtn} onClick={() => setModal(false)}>✕</button>
                                </div>
                                <div className={styles.chattingDisplay}>
                                    {messages.length !== 0 ? messages.map((item, index) => {
                                        console.log(messages)
                                        const isOwn = item.sender === username;
                                        return (
                                            <div key={index} className={`${styles.messageWrapper} ${isOwn ? styles.ownMessage : styles.otherMessage}`}>
                                                {!isOwn && <p className={styles.messageSender}>{item.sender}</p>}
                                                <div className={styles.messageBubble}>
                                                    <p className={styles.messageText}>{item.data}</p>
                                                </div>
                                                {item.timestamp && <p className={styles.messageTime}>{item.timestamp}</p>}
                                            </div>
                                        )
                                    }) :
                                        <div className={styles.noMessages}>
                                            <span>💬</span>
                                            <p>No messages yet</p>
                                            <p>Say hello!</p>
                                        </div>
                                    }
                                </div>
                                <div className={styles.chattingArea}>
                                    <TextField
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                        label="Message..."
                                        variant="outlined"
                                        size="small"
                                        sx={darkFieldSx}
                                    />
                                    <Button variant='contained' onClick={sendMessage}
                                        sx={{
                                            background: '#3b82f6', '&:hover': { background: '#2563eb' },
                                            borderRadius: '12px', minWidth: '60px',
                                            textTransform: 'none', fontWeight: 600,
                                            boxShadow: 'none', padding: '8px 14px', flexShrink: 0,
                                        }}
                                    >Send</Button>
                                </div>
                            </div>
                        </div>
                    }

                    {/* CONTROL BAR */}
                    <div className={styles.buttonContainers}>
                        <div className={styles.controlBar}>
                            <IconButton onClick={handleVideo} className={styles.controlBtn}>
                                {(video === true) ? <VideocamIcon /> : <VideocamOffIcon />}
                            </IconButton>
                            <IconButton onClick={handleEndCall} className={styles.endCallBtn}>
                                <CallEndIcon />
                            </IconButton>
                            <IconButton onClick={handleAudio} className={styles.controlBtn}>
                                {audio === true ? <MicIcon /> : <MicOffIcon />}
                            </IconButton>
                            {screenAvailable === true &&
                                <IconButton onClick={handleScreen} className={styles.controlBtn}>
                                    {screen === true ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                                </IconButton>
                            }
                            <IconButton onClick={handleRaiseHand} className={`${styles.controlBtn} ${handRaised ? styles.handBtn : ''}`} title="Raise Hand">
                                <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>✋</span>
                            </IconButton>
                            <div className={styles.reactionArea}>
                                {showReactions && (
                                    <div className={styles.reactionPicker}>
                                        {REACTIONS.map(emoji => (
                                            <button key={emoji} className={styles.reactionBtn} onClick={() => sendReaction(emoji)}>{emoji}</button>
                                        ))}
                                    </div>
                                )}
                                <IconButton onClick={() => setShowReactions(!showReactions)} className={`${styles.controlBtn} ${showReactions ? styles.controlBtnActive : ''}`} title="Reactions">
                                    <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>😊</span>
                                </IconButton>
                            </div>
                            <Badge badgeContent={newMessages} max={999} color='error'>
                                <IconButton onClick={() => setModal(!showModal)} className={styles.controlBtn}>
                                    <ChatIcon />
                                </IconButton>
                            </Badge>
                        </div>
                    </div>

                    {/* LOCAL VIDEO */}
                    <div className={styles.localVideoWrapper}>
                        <video className={`${styles.meetUserVideo} ${speaking['local'] ? styles.speakingVideo : ''}`} ref={localVideoref} autoPlay muted></video>
                        <span className={styles.youLabel}>You</span>
                        {handRaised && <span className={styles.handBadgeLocal}>✋</span>}
                    </div>

                    {/* EMPTY STATE */}
                    {videos.length === 0 &&
                        <div className={styles.emptyState}>
                            <div className={styles.emptyPulse}></div>
                            <p className={styles.emptyTitle}>Waiting for others to join...</p>
                            <p className={styles.emptySub}>Share the invite link to get started</p>
                        </div>
                    }

                    {/* PARTICIPANT TILES */}
                    <div className={styles.conferenceView}>
                        {videos.map((video) => (
                            <div key={video.socketId} className={`${styles.participantTile} ${speaking[video.socketId] ? styles.speakingTile : ''}`}>
                                <video
                                    data-socket={video.socketId}
                                    ref={ref => { if (ref && video.stream) ref.srcObject = video.stream; }}
                                    autoPlay
                                ></video>
                                {raisedHands[video.socketId] && <span className={styles.handBadge}>✋</span>}
                            </div>
                        ))}
                    </div>

                    {/* FLOATING REACTIONS */}
                    {activeReactions.map(r => (
                        <div key={r.id} className={styles.floatingReaction} style={{ left: `${r.x}%` }}>
                            {r.emoji}
                        </div>
                    ))}

                </div>
            }

        </div>
    )
}