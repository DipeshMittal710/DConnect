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
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import server from '../environment';

const server_url = server;
const REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥'];
var connections = {};
const peerConfigConnections = { "iceServers": [{ "urls": "stun:stun.l.google.com:19302" }] }

export default function VideoMeetComponent() {

    var socketRef           = useRef();
    let socketIdRef         = useRef();
    let localVideoref       = useRef();
    let timerRef            = useRef(null);
    const analysersRef      = useRef({});
    const speakingInterval  = useRef(null);
    const mediaRecorderRef  = useRef(null);
    const recordedChunksRef = useRef([]);
    const isHostRef         = useRef(false);
    const meetingLockedRef  = useRef(false);

    let [videoAvailable,  setVideoAvailable]  = useState(true);
    let [audioAvailable,  setAudioAvailable]  = useState(true);
    let [video,           setVideo]           = useState([]);
    let [audio,           setAudio]           = useState();
    let [screen,          setScreen]          = useState();
    let [screenAvailable, setScreenAvailable] = useState();
    let [messages,        setMessages]        = useState([]);
    let [message,         setMessage]         = useState("");
    let [newMessages,     setNewMessages]     = useState(0);
    let [askForUsername,  setAskForUsername]  = useState(true);
    let [username,        setUsername]        = useState("");
    const videoRef = useRef([]);
    let [videos, setVideos] = useState([]);

    let [callDuration, setCallDuration] = useState(0);
    let [isConnected,  setIsConnected]  = useState(false);
    let [inviteCopied, setInviteCopied] = useState(false);

    let [speaking,        setSpeaking]        = useState({});
    let [toasts,          setToasts]          = useState([]);
    let [handRaised,      setHandRaised]      = useState(false);
    let [raisedHands,     setRaisedHands]     = useState({});
    let [showReactions,   setShowReactions]   = useState(false);
    let [activeReactions, setActiveReactions] = useState([]);
    let [lobbyVideoOn,    setLobbyVideoOn]    = useState(true);
    let [lobbyAudioOn,    setLobbyAudioOn]    = useState(true);
    let [isRecording,     setIsRecording]     = useState(false);
    let [pinnedId,        setPinnedId]        = useState(null);
    let [cameras,         setCameras]         = useState([]);
    let [mics,            setMics]            = useState([]);
    let [selectedCamera,  setSelectedCamera]  = useState('');
    let [selectedMic,     setSelectedMic]     = useState('');

    // HOST STATES
    let [isHost,           setIsHost]           = useState(false);
    let [hostSocketId,     setHostSocketId]     = useState(null);
    let [meetingLocked,    setMeetingLocked]    = useState(false);
    let [showParticipants, setShowParticipants] = useState(false);
    let [showChat,         setShowChat]         = useState(false);
    let [participantNames, setParticipantNames] = useState({});
    let [remoteStates,     setRemoteStates]     = useState({});
    let [confirmKick,      setConfirmKick]      = useState(null);

    useEffect(() => { isHostRef.current       = isHost;        }, [isHost]);
    useEffect(() => { meetingLockedRef.current = meetingLocked; }, [meetingLocked]);

    useEffect(() => { getPermissions(); }, []);

    useEffect(() => {
        return () => {
            if (timerRef.current)         clearInterval(timerRef.current);
            if (speakingInterval.current) clearInterval(speakingInterval.current);
            Object.values(analysersRef.current).forEach(({ audioCtx }) => { try { audioCtx.close(); } catch (e) {} });
        };
    }, []);

    useEffect(() => {
        speakingInterval.current = setInterval(() => {
            const dataArray = new Uint8Array(128);
            const next = {};
            for (const [id, { analyser }] of Object.entries(analysersRef.current)) {
                try {
                    analyser.getByteFrequencyData(dataArray);
                    next[id] = dataArray.reduce((a, b) => a + b, 0) / dataArray.length > 15;
                } catch (e) {}
            }
            setSpeaking(prev => {
                const changed = Object.keys(next).length !== Object.keys(prev).length ||
                    Object.entries(next).some(([k, v]) => prev[k] !== v);
                return changed ? next : prev;
            });
        }, 100);
        return () => clearInterval(speakingInterval.current);
    }, []);

    useEffect(() => {
        videos.forEach(v => {
            if (v.stream && !analysersRef.current[v.socketId]) startSpeakingDetection(v.socketId, v.stream);
        });
        Object.keys(analysersRef.current).forEach(id => {
            if (id !== 'local' && !videos.find(v => v.socketId === id)) {
                try { analysersRef.current[id].audioCtx.close(); } catch (e) {}
                delete analysersRef.current[id];
            }
        });
    }, [videos]);

    const startSpeakingDetection = (socketId, stream) => {
        try {
            if (analysersRef.current[socketId]) return;
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            audioCtx.createMediaStreamSource(stream).connect(analyser);
            analysersRef.current[socketId] = { audioCtx, analyser };
        } catch (e) {}
    };

    const addToast = (msg, type = 'join') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    };

    const handleRaiseHand = () => {
        const next = !handRaised;
        setHandRaised(next);
        if (socketRef.current) socketRef.current.emit('chat-message', `__HAND__:${next}`, username);
        if (next) addToast('You raised your hand ✋', 'hand');
    };

    const triggerReaction = (emoji) => {
        const id = Date.now() + Math.random(), x = 20 + Math.random() * 60;
        setActiveReactions(prev => [...prev, { id, emoji, x }]);
        setTimeout(() => setActiveReactions(prev => prev.filter(r => r.id !== id)), 3200);
    };

    const sendReaction = (emoji) => {
        if (socketRef.current) socketRef.current.emit('chat-message', `__REACTION__:${emoji}`, username);
        triggerReaction(emoji);
        setShowReactions(false);
    };

    const toggleLobbyVideo = () => {
        if (window.localStream) {
            const next = !lobbyVideoOn;
            window.localStream.getVideoTracks().forEach(t => { t.enabled = next; });
            setLobbyVideoOn(next);
        }
    };

    const toggleLobbyAudio = () => {
        if (window.localStream) {
            const next = !lobbyAudioOn;
            window.localStream.getAudioTracks().forEach(t => { t.enabled = next; });
            setLobbyAudioOn(next);
        }
    };

    const startRecording = () => {
        try {
            const audioCtx    = new (window.AudioContext || window.webkitAudioContext)();
            const destination = audioCtx.createMediaStreamDestination();
            if (window.localStream) try { audioCtx.createMediaStreamSource(window.localStream).connect(destination); } catch(e) {}
            videos.forEach(v => { if (v.stream) try { audioCtx.createMediaStreamSource(v.stream).connect(destination); } catch(e) {} });
            const tracks = [];
            const vt = window.localStream?.getVideoTracks()[0];
            if (vt) tracks.push(vt);
            tracks.push(...destination.stream.getAudioTracks());
            const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
            const recorder = new MediaRecorder(new MediaStream(tracks), { mimeType: mime });
            recordedChunksRef.current = [];
            recorder.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href     = url;
                a.download = `DConnect-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.webm`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(url);
                try { audioCtx.close(); } catch(e) {}
            };
            mediaRecorderRef.current = recorder;
            recorder.start(1000);
            setIsRecording(true);
            addToast('Recording started ⏺', 'join');
        } catch(e) { addToast('Recording not supported', 'leave'); }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive')
            mediaRecorderRef.current.stop();
        setIsRecording(false);
        addToast('Recording saved ✓', 'hand');
    };

    const handleRecording = () => { if (isRecording) stopRecording(); else startRecording(); };
    const handlePin = (sid) => { setPinnedId(prev => prev === sid ? null : sid); };

    const playSound = (type) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const note = (freq, start, dur) => {
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.type = 'sine'; o.frequency.value = freq;
                o.connect(g); g.connect(ctx.destination);
                g.gain.setValueAtTime(0, start);
                g.gain.linearRampToValueAtTime(0.18, start + 0.02);
                g.gain.exponentialRampToValueAtTime(0.001, start + dur);
                o.start(start); o.stop(start + dur + 0.05);
            };
            const t = ctx.currentTime;
            if      (type === 'join')  { note(880, t, 0.18); note(1108, t+0.15, 0.22); }
            else if (type === 'leave') { note(660, t, 0.28); }
            else if (type === 'alert') { note(1046, t, 0.12); note(1046, t+0.18, 0.12); }
            setTimeout(() => { try { ctx.close(); } catch(e) {} }, 1500);
        } catch(e) {}
    };

    const enumerateDevices = async () => {
        try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const c = devs.filter(d => d.kind === 'videoinput');
            const m = devs.filter(d => d.kind === 'audioinput');
            setCameras(c); setMics(m);
            if (c.length) setSelectedCamera(p => p || c[0].deviceId);
            if (m.length) setSelectedMic(p    => p || m[0].deviceId);
        } catch(e) {}
    };

    const switchDevice = async (deviceId, kind) => {
        try {
            const constraints = {
                video: kind === 'video' ? { deviceId: { exact: deviceId } } : (videoAvailable && lobbyVideoOn),
                audio: kind === 'audio' ? { deviceId: { exact: deviceId } } : (audioAvailable && lobbyAudioOn),
            };
            if (!constraints.video && !constraints.audio) return;
            if (window.localStream)
                (kind === 'video' ? window.localStream.getVideoTracks() : window.localStream.getAudioTracks()).forEach(t => t.stop());
            const ns  = await navigator.mediaDevices.getUserMedia(constraints);
            const trk = kind === 'video' ? ns.getVideoTracks()[0] : ns.getAudioTracks()[0];
            if (trk) {
                trk.enabled = kind === 'video' ? lobbyVideoOn : lobbyAudioOn;
                const old = kind === 'video' ? window.localStream?.getVideoTracks() : window.localStream?.getAudioTracks();
                old?.forEach(t => window.localStream.removeTrack(t));
                window.localStream.addTrack(trk);
                if (kind === 'video' && localVideoref.current) localVideoref.current.srcObject = window.localStream;
            }
        } catch(e) {}
    };

    // HOST FUNCTIONS
    const hostMuteMic      = (id) => { socketRef.current.emit('chat-message', `__HOST_MUTE_MIC__:${id}`, username); setRemoteStates(p => ({...p,[id]:{...p[id],micMuted:true}})); };
    const hostUnmuteMicReq = (id) => { socketRef.current.emit('chat-message', `__HOST_UNMUTE_REQ__:${id}`, username); };
    const hostMuteCamera   = (id) => { socketRef.current.emit('chat-message', `__HOST_MUTE_CAM__:${id}`, username);  setRemoteStates(p => ({...p,[id]:{...p[id],camOff:true}}));  };
    const hostKick         = (id) => { socketRef.current.emit('chat-message', `__HOST_KICK__:${id}`, username); setConfirmKick(null); };
    const hostMuteAll      = ()   => {
        socketRef.current.emit('chat-message', '__HOST_MUTE_ALL__', username);
        const upd = {}; videos.forEach(v => { upd[v.socketId] = {...remoteStates[v.socketId], micMuted:true}; });
        setRemoteStates(p => ({...p,...upd}));
        addToast('All participants muted', 'hand');
    };
    const hostLockMeeting  = ()   => {
        const next = !meetingLocked;
        setMeetingLocked(next); meetingLockedRef.current = next;
        socketRef.current.emit('chat-message', `__HOST_LOCK__:${next}`, username);
        addToast(next ? '🔒 Meeting locked' : '🔓 Meeting unlocked', next ? 'leave' : 'join');
    };
    const hostTransfer     = (id) => {
        socketRef.current.emit('chat-message', `__HOST_TRANSFER__:${id}`, username);
        setIsHost(false); isHostRef.current = false; setHostSocketId(id);
        addToast('Host role transferred', 'hand');
    };

    const getPermissions = async () => {
        try {
            const vp = await navigator.mediaDevices.getUserMedia({ video: true }); setVideoAvailable(!!vp);
            const ap = await navigator.mediaDevices.getUserMedia({ audio: true }); setAudioAvailable(!!ap);
            setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
            if (videoAvailable || audioAvailable) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (stream) { window.localStream = stream; if (localVideoref.current) localVideoref.current.srcObject = stream; }
            }
            await enumerateDevices();
        } catch(e) { console.log(e); }
    };

    useEffect(() => { if (video !== undefined && audio !== undefined) getUserMedia(); }, [video, audio]);

    const getMedia = () => {
        setVideo(lobbyVideoOn && videoAvailable);
        setAudio(lobbyAudioOn && audioAvailable);
        connectToSocketServer();
    };

    const getUserMediaSuccess = (stream) => {
        try { window.localStream.getTracks().forEach(t => t.stop()); } catch(e) {}
        window.localStream = stream; localVideoref.current.srcObject = stream;
        if (analysersRef.current['local']) { try { analysersRef.current['local'].audioCtx.close(); } catch(e) {} delete analysersRef.current['local']; }
        startSpeakingDetection('local', stream);
        for (let id in connections) {
            if (id === socketIdRef.current) continue;
            connections[id].addStream(window.localStream);
            connections[id].createOffer().then(d => { connections[id].setLocalDescription(d).then(() => socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }))).catch(e => console.log(e)); });
        }
        stream.getTracks().forEach(t => t.onended = () => {
            setVideo(false); setAudio(false);
            try { localVideoref.current.srcObject.getTracks().forEach(t => t.stop()); } catch(e) {}
            const bs = (...a) => new MediaStream([black(...a), silence()]);
            window.localStream = bs(); localVideoref.current.srcObject = window.localStream;
            for (let id in connections) {
                connections[id].addStream(window.localStream);
                connections[id].createOffer().then(d => { connections[id].setLocalDescription(d).then(() => socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }))).catch(e => console.log(e)); });
            }
        });
    };

    const getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable))
            navigator.mediaDevices.getUserMedia({ video, audio }).then(getUserMediaSuccess).catch(e => console.log(e));
        else try { localVideoref.current.srcObject.getTracks().forEach(t => t.stop()); } catch(e) {}
    };

    const getDislayMedia = () => {
        if (screen && navigator.mediaDevices.getDisplayMedia)
            navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then(getDislayMediaSuccess).catch(e => console.log(e));
    };

    const getDislayMediaSuccess = (stream) => {
        try { window.localStream.getTracks().forEach(t => t.stop()); } catch(e) {}
        window.localStream = stream; localVideoref.current.srcObject = stream;
        for (let id in connections) {
            if (id === socketIdRef.current) continue;
            connections[id].addStream(window.localStream);
            connections[id].createOffer().then(d => { connections[id].setLocalDescription(d).then(() => socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }))).catch(e => console.log(e)); });
        }
        stream.getTracks().forEach(t => t.onended = () => {
            setScreen(false);
            try { localVideoref.current.srcObject.getTracks().forEach(t => t.stop()); } catch(e) {}
            const bs = (...a) => new MediaStream([black(...a), silence()]);
            window.localStream = bs(); localVideoref.current.srcObject = window.localStream;
            getUserMedia();
        });
    };

    const gotMessageFromServer = (fromId, msg) => {
        const signal = JSON.parse(msg);
        if (fromId === socketIdRef.current) return;
        if (signal.sdp) {
            connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                if (signal.sdp.type === 'offer')
                    connections[fromId].createAnswer().then(d => { connections[fromId].setLocalDescription(d).then(() => socketRef.current.emit('signal', fromId, JSON.stringify({ sdp: connections[fromId].localDescription }))).catch(e => console.log(e)); }).catch(e => console.log(e));
            }).catch(e => console.log(e));
        }
        if (signal.ice) connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
    };

    const connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false });
        socketRef.current.on('signal', gotMessageFromServer);
        socketRef.current.on('disconnect', () => setIsConnected(false));

        socketRef.current.on('connect', () => {
            setIsConnected(true);
            socketRef.current.emit('join-call', window.location.href);
            socketIdRef.current = socketRef.current.id;
            socketRef.current.on('chat-message', addMessage);

            socketRef.current.on('user-left', (id) => {
                playSound('leave');
                addToast('A participant left', 'leave');
                setPinnedId(p => p === id ? null : p);
                setParticipantNames(p => { const n={...p}; delete n[id]; return n; });
                setRemoteStates(p    => { const n={...p}; delete n[id]; return n; });
                setVideos(vs => vs.filter(v => v.socketId !== id));
            });

            socketRef.current.on('user-joined', (id, clients) => {
                if (id === socketIdRef.current && clients.length === 1) {
                    setIsHost(true); isHostRef.current = true; setHostSocketId(socketIdRef.current);
                    setTimeout(() => socketRef.current.emit('chat-message', `__HOST_CLAIM__:${socketIdRef.current}`, username), 400);
                }
                if (id !== socketIdRef.current) {
                    if (isHostRef.current && meetingLockedRef.current)
                        setTimeout(() => socketRef.current.emit('chat-message', `__HOST_KICK__:${id}`, username), 600);
                    playSound('join');
                    addToast('A participant joined', 'join');
                    setTimeout(() => {
                        socketRef.current.emit('chat-message', `__USERNAME__:${username}`, username);
                        if (isHostRef.current) socketRef.current.emit('chat-message', `__HOST_CLAIM__:${socketIdRef.current}`, username);
                    }, 300);
                }
                clients.forEach(sid => {
                    connections[sid] = new RTCPeerConnection(peerConfigConnections);
                    connections[sid].onicecandidate = ev => { if (ev.candidate) socketRef.current.emit('signal', sid, JSON.stringify({ ice: ev.candidate })); };
                    connections[sid].onaddstream = ev => {
                        const exists = videoRef.current.find(v => v.socketId === sid);
                        if (exists) setVideos(vs => { const u=vs.map(v=>v.socketId===sid?{...v,stream:ev.stream}:v); videoRef.current=u; return u; });
                        else { const nv={socketId:sid,stream:ev.stream,autoplay:true,playsinline:true}; setVideos(vs=>{const u=[...vs,nv];videoRef.current=u;return u;}); }
                    };
                    if (window.localStream) connections[sid].addStream(window.localStream);
                    else { const bs=(...a)=>new MediaStream([black(...a),silence()]); window.localStream=bs(); connections[sid].addStream(window.localStream); }
                });
                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue;
                        try { connections[id2].addStream(window.localStream); } catch(e) {}
                        connections[id2].createOffer().then(d => { connections[id2].setLocalDescription(d).then(() => socketRef.current.emit('signal', id2, JSON.stringify({ sdp: connections[id2].localDescription }))).catch(e=>console.log(e)); });
                    }
                }
            });
        });
    };

    const silence = () => {
        const ctx=new AudioContext(), osc=ctx.createOscillator(), dst=osc.connect(ctx.createMediaStreamDestination());
        osc.start(); ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled:false });
    };
    const black = ({width=640,height=480}={}) => {
        const c=Object.assign(document.createElement('canvas'),{width,height});
        c.getContext('2d').fillRect(0,0,width,height);
        return Object.assign(c.captureStream().getVideoTracks()[0],{enabled:false});
    };

    const handleVideo  = () => setVideo(!video);
    const handleAudio  = () => setAudio(!audio);
    const handleScreen = () => setScreen(!screen);

    useEffect(() => { if (screen !== undefined) getDislayMedia(); }, [screen]);

    const handleEndCall = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (isRecording) stopRecording();
        Object.values(analysersRef.current).forEach(({audioCtx}) => { try { audioCtx.close(); } catch(e) {} });
        analysersRef.current = {};
        try { localVideoref.current.srcObject.getTracks().forEach(t => t.stop()); } catch(e) {}
        window.location.href = "/";
    };

    const addMessage = (data, sender, socketIdSender) => {
        // Track name
        if (socketIdSender && sender && !data.startsWith('__'))
            setParticipantNames(p => ({...p,[socketIdSender]:sender}));

        if (data.startsWith('__USERNAME__:'))       { setParticipantNames(p=>({...p,[socketIdSender]:sender})); return; }
        if (data.startsWith('__HOST_CLAIM__:'))      { const id=data.replace('__HOST_CLAIM__:',''); setHostSocketId(id); if(id===socketIdRef.current){setIsHost(true);isHostRef.current=true;} return; }
        if (data.startsWith('__HOST_TRANSFER__:'))   {
            const nid=data.replace('__HOST_TRANSFER__:',''); setHostSocketId(nid);
            if(nid===socketIdRef.current){setIsHost(true);isHostRef.current=true;addToast('You are now the host 👑','hand');playSound('alert');}
            else if(socketIdSender===socketIdRef.current){setIsHost(false);isHostRef.current=false;} return; }
        if (data.startsWith('__HOST_MUTE_MIC__:'))   { const tid=data.replace('__HOST_MUTE_MIC__:',''); if(tid===socketIdRef.current||tid==='all'){setAudio(false);if(window.localStream)window.localStream.getAudioTracks().forEach(t=>{t.enabled=false;});addToast('Host muted your microphone 🔇','leave');playSound('alert');} return; }
        if (data === '__HOST_MUTE_ALL__')             { if(socketIdSender!==socketIdRef.current){setAudio(false);if(window.localStream)window.localStream.getAudioTracks().forEach(t=>{t.enabled=false;});addToast('Host muted all microphones 🔇','leave');playSound('alert');} return; }
        if (data.startsWith('__HOST_UNMUTE_REQ__:'))  { const tid=data.replace('__HOST_UNMUTE_REQ__:',''); if(tid===socketIdRef.current){addToast('Host is asking you to unmute 🎙️','hand');playSound('alert');} return; }
        if (data.startsWith('__HOST_MUTE_CAM__:'))    { const tid=data.replace('__HOST_MUTE_CAM__:',''); if(tid===socketIdRef.current){setVideo(false);if(window.localStream)window.localStream.getVideoTracks().forEach(t=>{t.enabled=false;});addToast('Host turned off your camera 📷','leave');playSound('alert');} return; }
        if (data.startsWith('__HOST_KICK__:'))         { const tid=data.replace('__HOST_KICK__:',''); if(tid===socketIdRef.current){addToast('You have been removed from the meeting','leave');playSound('leave');setTimeout(()=>handleEndCall(),1800);} return; }
        if (data.startsWith('__HOST_LOCK__:'))         { const locked=data.replace('__HOST_LOCK__:','')==='true'; setMeetingLocked(locked); meetingLockedRef.current=locked; if(socketIdSender!==socketIdRef.current)addToast(locked?'🔒 Meeting locked by host':'🔓 Meeting unlocked',locked?'leave':'join'); return; }
        if (data.startsWith('__HAND__:'))             { if(socketIdSender!==socketIdRef.current){const r=data.split(':')[1]==='true'; setRaisedHands(p=>({...p,[socketIdSender]:r})); if(r)addToast(`${sender} raised their hand ✋`,'hand');} return; }
        if (data.startsWith('__REACTION__:'))          { if(socketIdSender!==socketIdRef.current)triggerReaction(data.split(':')[1]); return; }

        setParticipantNames(p=>({...p,[socketIdSender]:sender}));
        setMessages(prev=>[...prev,{sender,data,timestamp:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}]);
        if (socketIdSender!==socketIdRef.current) setNewMessages(p=>p+1);
    };

    const sendMessage = () => { socketRef.current.emit('chat-message', message, username); setMessage(""); };
    const connect     = () => { setAskForUsername(false); getMedia(); timerRef.current=setInterval(()=>setCallDuration(p=>p+1),1000); };
    const formatTime  = (s) => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; };
    const getRoomName = () => { const p=window.location.pathname.split('/'); return p[p.length-1]||'Meeting'; };
    const handleInvite = () => { navigator.clipboard.writeText(getRoomName()); setInviteCopied(true); setTimeout(()=>setInviteCopied(false),2500); };

    const openSidePanel  = (panel) => { if(panel==='chat'){setShowChat(true);setShowParticipants(false);setNewMessages(0);}else{setShowParticipants(true);setShowChat(false);} };
    const closeSidePanel = () => { setShowChat(false); setShowParticipants(false); };
    const isSidePanelOpen = showChat || showParticipants;

    const getName = (sid) => participantNames[sid] || 'Participant';

    const pinnedVideo = videos.find(v => v.socketId === pinnedId);
    const otherVideos = videos.filter(v => v.socketId !== pinnedId);

    const darkFieldSx = { flex:1,'& .MuiOutlinedInput-root':{color:'#fff',borderRadius:'12px','& fieldset':{borderColor:'rgba(255,255,255,0.15)'},'&:hover fieldset':{borderColor:'rgba(255,255,255,0.3)'},'&.Mui-focused fieldset':{borderColor:'#3b82f6'}},'& .MuiInputLabel-root':{color:'rgba(255,255,255,0.4)'},'& .MuiInputLabel-root.Mui-focused':{color:'#3b82f6'} };
    const lobbyFieldSx = { width:'100%','& .MuiOutlinedInput-root':{color:'#fff',borderRadius:'10px','& fieldset':{borderColor:'rgba(255,255,255,0.2)'},'&:hover fieldset':{borderColor:'rgba(255,255,255,0.4)'},'&.Mui-focused fieldset':{borderColor:'#3b82f6'}},'& .MuiInputLabel-root':{color:'rgba(255,255,255,0.5)'},'& .MuiInputLabel-root.Mui-focused':{color:'#3b82f6'} };

    return (
        <div>
        {askForUsername ? (
            <div className={styles.lobbyContainer}>
                <div className={styles.lobbyCard}>
                    <div className={styles.lobbyBrand}><h1>DConnect</h1><p>HD video calls, right in your browser</p></div>
                    <div className={styles.lobbyPreview}>
                        <video ref={localVideoref} autoPlay muted></video>
                        {!lobbyVideoOn&&(<div className={styles.lobbyVideoOffOverlay}><VideocamOffIcon sx={{fontSize:'2.8rem',color:'rgba(255,255,255,0.35)'}} /><p>Camera is off</p></div>)}
                    </div>
                    <div className={styles.lobbyDeviceRow}>
                        <button onClick={toggleLobbyVideo} className={`${styles.lobbyDeviceBtn} ${!lobbyVideoOn?styles.lobbyDeviceBtnOff:''}`}>{lobbyVideoOn?<VideocamIcon sx={{fontSize:'1.15rem'}}/>:<VideocamOffIcon sx={{fontSize:'1.15rem'}}/>}<span>{lobbyVideoOn?'Camera On':'Camera Off'}</span></button>
                        <button onClick={toggleLobbyAudio} className={`${styles.lobbyDeviceBtn} ${!lobbyAudioOn?styles.lobbyDeviceBtnOff:''}`}>{lobbyAudioOn?<MicIcon sx={{fontSize:'1.15rem'}}/>:<MicOffIcon sx={{fontSize:'1.15rem'}}/>}<span>{lobbyAudioOn?'Mic On':'Mic Off'}</span></button>
                    </div>
                    {(cameras.length>1||mics.length>1)&&(
                        <div className={styles.deviceSelectors}>
                            {cameras.length>1&&(<div className={styles.deviceSelectGroup}><label className={styles.deviceSelectLabel}>🎥 Camera</label><div className={styles.deviceSelectWrapper}><select className={styles.deviceSelect} value={selectedCamera} onChange={e=>{setSelectedCamera(e.target.value);switchDevice(e.target.value,'video');}}>{cameras.map((c,i)=><option key={c.deviceId} value={c.deviceId}>{c.label||`Camera ${i+1}`}</option>)}</select></div></div>)}
                            {mics.length>1&&(<div className={styles.deviceSelectGroup}><label className={styles.deviceSelectLabel}>🎙️ Microphone</label><div className={styles.deviceSelectWrapper}><select className={styles.deviceSelect} value={selectedMic} onChange={e=>{setSelectedMic(e.target.value);switchDevice(e.target.value,'audio');}}>{mics.map((m,i)=><option key={m.deviceId} value={m.deviceId}>{m.label||`Mic ${i+1}`}</option>)}</select></div></div>)}
                        </div>
                    )}
                    <div className={styles.lobbyForm}>
                        <TextField label="Your display name" value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==='Enter'&&username.trim()&&connect()} variant="outlined" sx={lobbyFieldSx}/>
                        <Button variant="contained" onClick={connect} disabled={!username.trim()} fullWidth sx={{mt:1.5,py:1.5,background:'#3b82f6','&:hover':{background:'#2563eb'},'&.Mui-disabled':{background:'rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.25)'},borderRadius:'10px',fontSize:'1rem',fontWeight:600,textTransform:'none',letterSpacing:0,boxShadow:'none'}}>
                            Join Now{(!lobbyVideoOn||!lobbyAudioOn)&&<span className={styles.joinHint}>{!lobbyVideoOn&&!lobbyAudioOn?' · No cam, no mic':!lobbyVideoOn?' · No camera':' · Muted'}</span>}
                        </Button>
                    </div>
                </div>
            </div>
        ) : (
            <div className={styles.meetVideoContainer}>

                {/* NAVBAR */}
                <div className={styles.navbar}>
                    <div className={styles.navLeft}>
                        <span className={styles.navBrand}>DConnect {isHost&&<span className={styles.hostCrown}>👑</span>}</span>
                        <span className={styles.navRoom}>Room: {getRoomName()}</span>
                        {meetingLocked&&<span className={styles.lockBadge}>🔒 Locked</span>}
                    </div>
                    <div className={styles.navCenter}>
                        <span className={styles.navStatus}><span className={isConnected?styles.dotConnected:styles.dotConnecting}></span>{isConnected?'Connected':'Connecting...'}</span>
                        <span className={styles.navDivider}>|</span>
                        <span className={styles.navTimer}>{formatTime(callDuration)}</span>
                    </div>
                    <div className={styles.navRight}>
                        <span className={styles.navParticipants}>👥 {videos.length+1}</span>
                        <button className={`${styles.navBtn} ${inviteCopied?styles.navBtnCopied:''}`} onClick={handleInvite}>{inviteCopied?`✓ Code: ${getRoomName()}`:`Invite`}</button>
                        {isHost&&<button className={`${styles.navBtn} ${meetingLocked?styles.navBtnLocked:''}`} onClick={hostLockMeeting}>{meetingLocked?'🔓 Unlock':'🔒 Lock'}</button>}
                    </div>
                </div>

                {/* TOASTS */}
                <div className={styles.toastContainer}>
                    {toasts.map(t=>(
                        <div key={t.id} className={`${styles.toast} ${styles[`toast_${t.type}`]||''}`}>
                            {t.type==='join'&&<span className={styles.toastDot} style={{background:'#22c55e'}}></span>}
                            {t.type==='leave'&&<span className={styles.toastDot} style={{background:'#ef4444'}}></span>}
                            {t.type==='hand'&&<span style={{marginRight:6}}>✋</span>}
                            {t.msg}
                        </div>
                    ))}
                </div>

                {/* SIDE PANEL */}
                {isSidePanelOpen&&(
                    <div className={styles.sidePanel}>
                        <div className={styles.sidePanelTabs}>
                            <button className={`${styles.sidePanelTab} ${showParticipants?styles.sidePanelTabActive:''}`} onClick={()=>openSidePanel('participants')}>👥 People ({videos.length+1})</button>
                            <button className={`${styles.sidePanelTab} ${showChat?styles.sidePanelTabActive:''}`} onClick={()=>openSidePanel('chat')}>💬 Chat {newMessages>0&&!showChat&&<span className={styles.chatBadge}>{newMessages}</span>}</button>
                            <button className={styles.sidePanelClose} onClick={closeSidePanel}>✕</button>
                        </div>

                        {/* PARTICIPANTS TAB */}
                        {showParticipants&&(
                            <div className={styles.participantsContent}>
                                {isHost&&<div className={styles.hostBulkRow}><button className={styles.hostBulkBtn} onClick={hostMuteAll}>🔇 Mute All</button></div>}
                                {/* Me */}
                                <div className={styles.participantItem}>
                                    <div className={styles.participantInfo}>
                                        <span className={styles.participantAvatar}>{username.charAt(0).toUpperCase()}</span>
                                        <div><span className={styles.participantName}>{username}{isHost&&<span className={styles.hostTag}>👑 Host</span>}</span><span className={styles.participantYou}>(You)</span></div>
                                    </div>
                                    <div className={styles.participantStatus}>
                                        {audio?<MicIcon sx={{fontSize:'1rem',color:'#22c55e'}}/>:<MicOffIcon sx={{fontSize:'1rem',color:'#ef4444'}}/>}
                                        {video?<VideocamIcon sx={{fontSize:'1rem',color:'#22c55e'}}/>:<VideocamOffIcon sx={{fontSize:'1rem',color:'#ef4444'}}/>}
                                    </div>
                                </div>
                                {/* Others */}
                                {videos.map(v=>(
                                    <div key={v.socketId}>
                                        <div className={styles.participantItem}>
                                            <div className={styles.participantInfo}>
                                                <span className={styles.participantAvatar}>{getName(v.socketId).charAt(0).toUpperCase()}</span>
                                                <div>
                                                    <span className={styles.participantName}>{getName(v.socketId)}{v.socketId===hostSocketId&&<span className={styles.hostTag}>👑 Host</span>}</span>
                                                    {raisedHands[v.socketId]&&<span className={styles.handIndicator}>✋ Hand raised</span>}
                                                </div>
                                            </div>
                                            <div className={styles.participantStatus}>
                                                {remoteStates[v.socketId]?.micMuted?<MicOffIcon sx={{fontSize:'1rem',color:'#ef4444'}}/>:<MicIcon sx={{fontSize:'1rem',color:'rgba(255,255,255,0.4)'}}/>}
                                                {remoteStates[v.socketId]?.camOff?<VideocamOffIcon sx={{fontSize:'1rem',color:'#ef4444'}}/>:<VideocamIcon sx={{fontSize:'1rem',color:'rgba(255,255,255,0.4)'}}/>}
                                            </div>
                                            {isHost&&(
                                                <div className={styles.hostParticipantActions}>
                                                    <button className={styles.hostActionBtn} onClick={()=>hostMuteMic(v.socketId)}      title="Mute mic">🔇</button>
                                                    <button className={styles.hostActionBtn} onClick={()=>hostUnmuteMicReq(v.socketId)} title="Ask unmute">🎙️</button>
                                                    <button className={styles.hostActionBtn} onClick={()=>hostMuteCamera(v.socketId)}   title="Turn off cam">📷</button>
                                                    <button className={styles.hostActionBtn} onClick={()=>hostTransfer(v.socketId)}     title="Make host">👑</button>
                                                    <button className={`${styles.hostActionBtn} ${styles.hostKickBtn}`} onClick={()=>setConfirmKick(v.socketId)} title="Remove">✕</button>
                                                </div>
                                            )}
                                        </div>
                                        {confirmKick===v.socketId&&(
                                            <div className={styles.kickConfirm}>
                                                <span>Remove {getName(v.socketId)}?</span>
                                                <button className={styles.kickConfirmYes} onClick={()=>hostKick(v.socketId)}>Remove</button>
                                                <button className={styles.kickConfirmNo}  onClick={()=>setConfirmKick(null)}>Cancel</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* CHAT TAB */}
                        {showChat&&(
                            <div className={styles.chatContent}>
                                <div className={styles.chattingDisplay}>
                                    {messages.length>0?messages.map((item,idx)=>{
                                        const own=item.sender===username;
                                        return(<div key={idx} className={`${styles.messageWrapper} ${own?styles.ownMessage:styles.otherMessage}`}>
                                            {!own&&<p className={styles.messageSender}>{item.sender}</p>}
                                            <div className={styles.messageBubble}><p className={styles.messageText}>{item.data}</p></div>
                                            {item.timestamp&&<p className={styles.messageTime}>{item.timestamp}</p>}
                                        </div>);
                                    }):<div className={styles.noMessages}><span>💬</span><p>No messages yet</p><p>Say hello!</p></div>}
                                </div>
                                <div className={styles.chattingArea}>
                                    <TextField value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}} label="Message..." variant="outlined" size="small" sx={darkFieldSx}/>
                                    <Button variant='contained' onClick={sendMessage} sx={{background:'#3b82f6','&:hover':{background:'#2563eb'},borderRadius:'12px',minWidth:'60px',textTransform:'none',fontWeight:600,boxShadow:'none',padding:'8px 14px',flexShrink:0}}>Send</Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* CONTROL BAR */}
                <div className={styles.buttonContainers}>
                    <div className={styles.controlBar}>
                        <IconButton onClick={handleVideo} className={styles.controlBtn}>{video===true?<VideocamIcon/>:<VideocamOffIcon/>}</IconButton>
                        <IconButton onClick={handleEndCall} className={styles.endCallBtn}><CallEndIcon/></IconButton>
                        <IconButton onClick={handleAudio} className={styles.controlBtn}>{audio===true?<MicIcon/>:<MicOffIcon/>}</IconButton>
                        {screenAvailable===true&&<IconButton onClick={handleScreen} className={styles.controlBtn}>{screen===true?<ScreenShareIcon/>:<StopScreenShareIcon/>}</IconButton>}
                        <IconButton onClick={handleRecording} className={`${styles.controlBtn} ${isRecording?styles.recordingActive:''}`} title={isRecording?'Stop Recording':'Record'}>
                            {isRecording?<span className={styles.recordDot}></span>:<span style={{fontSize:'1.1rem',lineHeight:1}}>⏺</span>}
                        </IconButton>
                        <IconButton onClick={handleRaiseHand} className={`${styles.controlBtn} ${handRaised?styles.handBtn:''}`} title="Raise Hand"><span style={{fontSize:'1.25rem',lineHeight:1}}>✋</span></IconButton>
                        <div className={styles.reactionArea}>
                            {showReactions&&(<div className={styles.reactionPicker}>{REACTIONS.map(e=><button key={e} className={styles.reactionBtn} onClick={()=>sendReaction(e)}>{e}</button>)}</div>)}
                            <IconButton onClick={()=>setShowReactions(!showReactions)} className={`${styles.controlBtn} ${showReactions?styles.controlBtnActive:''}`} title="Reactions"><span style={{fontSize:'1.25rem',lineHeight:1}}>😊</span></IconButton>
                        </div>
                        <IconButton onClick={()=>isSidePanelOpen&&showParticipants?closeSidePanel():openSidePanel('participants')} className={`${styles.controlBtn} ${showParticipants?styles.controlBtnActive:''}`} title="Participants"><PeopleAltIcon/></IconButton>
                        <Badge badgeContent={!showChat?newMessages:0} max={99} color='error'>
                            <IconButton onClick={()=>isSidePanelOpen&&showChat?closeSidePanel():openSidePanel('chat')} className={`${styles.controlBtn} ${showChat?styles.controlBtnActive:''}`} title="Chat"><ChatIcon/></IconButton>
                        </Badge>
                    </div>
                </div>

                {/* LOCAL VIDEO */}
                <div className={styles.localVideoWrapper}>
                    <video className={`${styles.meetUserVideo} ${speaking['local']?styles.speakingVideo:''}`} ref={localVideoref} autoPlay muted></video>
                    <span className={styles.youLabel}>You{isHost?' 👑':''}</span>
                    {handRaised&&<span className={styles.handBadgeLocal}>✋</span>}
                    {isRecording&&<span className={styles.recordingBadge}>⏺ REC</span>}
                </div>

                {/* EMPTY STATE */}
                {videos.length===0&&(<div className={styles.emptyState}><div className={styles.emptyPulse}></div><p className={styles.emptyTitle}>Waiting for others to join...</p><p className={styles.emptySub}>Share code <strong>{getRoomName()}</strong> to invite</p></div>)}

                {/* TILES */}
                {pinnedVideo?(
                    <div className={styles.conferenceViewSpotlight}>
                        <div className={`${styles.pinnedTile} ${speaking[pinnedVideo.socketId]?styles.speakingTile:''}`} onClick={()=>handlePin(pinnedVideo.socketId)} title="Click to unpin">
                            <video data-socket={pinnedVideo.socketId} ref={ref=>{if(ref&&pinnedVideo.stream)ref.srcObject=pinnedVideo.stream;}} autoPlay></video>
                            {raisedHands[pinnedVideo.socketId]&&<span className={styles.handBadge}>✋</span>}
                            <span className={styles.pinnedLabel}>📌 {getName(pinnedVideo.socketId)} — click to unpin</span>
                        </div>
                        {otherVideos.length>0&&(
                            <div className={styles.thumbnailStrip}>
                                {otherVideos.map(v=>(
                                    <div key={v.socketId} className={`${styles.thumbnailTile} ${speaking[v.socketId]?styles.thumbnailSpeaking:''}`} onClick={()=>handlePin(v.socketId)}>
                                        <video data-socket={v.socketId} ref={ref=>{if(ref&&v.stream)ref.srcObject=v.stream;}} autoPlay></video>
                                        {raisedHands[v.socketId]&&<span className={styles.handBadgeSm}>✋</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ):(
                    <div className={styles.conferenceView}>
                        {videos.map(v=>(
                            <div key={v.socketId} className={`${styles.participantTile} ${speaking[v.socketId]?styles.speakingTile:''}`}>
                                <video data-socket={v.socketId} ref={ref=>{if(ref&&v.stream)ref.srcObject=v.stream;}} autoPlay></video>
                                {raisedHands[v.socketId]&&<span className={styles.handBadge}>✋</span>}
                                {v.socketId===hostSocketId&&<span className={styles.tileHostBadge}>👑</span>}
                                <span className={styles.tileName}>{getName(v.socketId)}</span>
                                <span className={styles.pinHint} onClick={()=>handlePin(v.socketId)}>📌</span>
                                {isHost&&(
                                    <div className={styles.hostTileOverlay}>
                                        <button className={styles.hostTileBtn} onClick={()=>hostMuteMic(v.socketId)}    title="Mute">🔇</button>
                                        <button className={styles.hostTileBtn} onClick={()=>hostMuteCamera(v.socketId)} title="Cam off">📷</button>
                                        <button className={`${styles.hostTileBtn} ${styles.hostTileKick}`} onClick={()=>setConfirmKick(v.socketId)} title="Remove">✕</button>
                                    </div>
                                )}
                                {confirmKick===v.socketId&&(
                                    <div className={styles.kickConfirmOverlay}>
                                        <p>Remove {getName(v.socketId)}?</p>
                                        <button className={styles.kickConfirmYes} onClick={()=>hostKick(v.socketId)}>Yes, Remove</button>
                                        <button className={styles.kickConfirmNo}  onClick={()=>setConfirmKick(null)}>Cancel</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* REACTIONS */}
                {activeReactions.map(r=>(
                    <div key={r.id} className={styles.floatingReaction} style={{left:`${r.x}%`}}>{r.emoji}</div>
                ))}

            </div>
        )}
        </div>
    );
}