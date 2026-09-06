import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField, MenuItem, Select, FormControl } from '@mui/material';
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
import ClosedCaptionIcon from '@mui/icons-material/ClosedCaption'
import ClosedCaptionOffIcon from '@mui/icons-material/ClosedCaptionOff'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import WifiIcon from '@mui/icons-material/Wifi'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import server from '../environment';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import FlipIcon from '@mui/icons-material/Flip';
import BarChartIcon from '@mui/icons-material/BarChart';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import GridViewIcon from '@mui/icons-material/GridView';

const server_url = server;
const REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥'];
const EMOJI_LIST = ['😀','😂','😍','😎','🤔','😢','😡','🥳','👍','👎','❤️','🔥','🎉','💯','🙏','👏','🤝','💪','✅','❌','⭐','🚀','💡','📢','🎯','🎶','🍕','☕','🌟','💎'];
const QUALITY_PRESETS = {
    '360p':  { width: 640,  height: 360,  frameRate: 15 },
    '720p':  { width: 1280, height: 720,  frameRate: 24 },
    '1080p': { width: 1920, height: 1080, frameRate: 30 },
};
var connections = {};
const peerConfigConnections = { "iceServers": [{ "urls": "stun:stun.l.google.com:19302" }] }

export default function VideoMeetComponent() {

    var socketRef              = useRef();
    let socketIdRef            = useRef();
    let localVideoref          = useRef();
    let timerRef               = useRef(null);
    const analysersRef         = useRef({});
    const speakingInterval     = useRef(null);
    const mediaRecorderRef     = useRef(null);
    const recordedChunksRef    = useRef([]);
    const recordingRAFRef      = useRef(null);
    const remoteVideoElsRef    = useRef({});
    const isHostRef            = useRef(false);
    const recognitionRef       = useRef(null);
    const captionsOnRef        = useRef(false);
    const audioRef             = useRef(false);
    const captionClearTimeoutRef = useRef(null);
    const pushToTalkRef        = useRef(false);
    const screenRef            = useRef(false);
    const usernameRef          = useRef('');
    const noiseAudioCtxRef     = useRef(null);    // NEW: noise cancellation
    const originalAudioTrackRef = useRef(null);   // NEW: noise cancellation
    const chatBottomRef   = useRef(null);   // chat scroll
    const chatDisplayRef  = useRef(null);   // chat scroll position check
    const qualityInterval = useRef(null);   // connection quality polling

    // existing states
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
    let [pinnedId,        setPinnedId]        = useState(null);
    let [cameras,         setCameras]         = useState([]);
    let [mics,            setMics]            = useState([]);
    let [selectedCamera,  setSelectedCamera]  = useState('');
    let [selectedMic,     setSelectedMic]     = useState('');

    // host / meeting states
    let [isHost,           setIsHost]           = useState(false);
    let [hostSocketId,     setHostSocketId]     = useState(null);
    let [meetingLocked,    setMeetingLocked]    = useState(false);
    let [showParticipants, setShowParticipants] = useState(false);
    let [showChat,         setShowChat]         = useState(false);
    let [participantNames, setParticipantNames] = useState({});
    let [remoteStates,     setRemoteStates]     = useState({});
    let [confirmKick,      setConfirmKick]      = useState(null);
    let [isRecording,      setIsRecording]      = useState(false);
    let [isRemoteRecording,setIsRemoteRecording]= useState(false);

    // captions / shortcuts
    let [captionsOn,        setCaptionsOn]        = useState(false);
    let [activeCaption,     setActiveCaption]     = useState(null);
    let [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    let [showMoreMenu,      setShowMoreMenu]      = useState(false);

    // NEW: 5 features
    let [coHosts,             setCoHosts]             = useState([]);           // Co-hosts
    let [waitingRoomEnabled,  setWaitingRoomEnabled]  = useState(false);        // Waiting room
    let [waitingParticipants, setWaitingParticipants] = useState([]);           // {socketId, name}
    let [waitingForAdmission, setWaitingForAdmission] = useState(false);        // I'm in waiting room
    let [noiseCancellation,   setNoiseCancellation]   = useState(false);        // Noise cancellation
    let [privateTarget,       setPrivateTarget]       = useState('all');        // DM target
    let [privateMessages,     setPrivateMessages]     = useState([]);           // DM history {to/from/text}
    let [theme,               setTheme]               = useState(              // Dark/light
        () => localStorage.getItem('dconnect-theme') || 'dark'
    );
    // NEW: 6 additional features
    let [mirrorVideo,        setMirrorVideo]        = useState(true);    // mirror own cam
    let [isFullscreen,       setIsFullscreen]       = useState(false);
    let [showScrollBtn,      setShowScrollBtn]      = useState(false);   // chat scroll
    let [viewMode,           setViewMode]           = useState('grid');  // 'grid'|'speaker'
    let [videoQuality,       setVideoQuality]       = useState('720p'); // lobby quality
    let [connectionQuality,  setConnectionQuality]  = useState({});     // sid->1-4 bars
    let [showQR,             setShowQR]             = useState(false);   // QR modal
    let [showEmojiPicker,    setShowEmojiPicker]    = useState(false);  // emoji picker
    let [activePoll,         setActivePoll]         = useState(null);   // {question,options}
    let [pollVotes,          setPollVotes]          = useState({});     // {socketId:idx}
    let [myVote,             setMyVote]             = useState(null);   // my chosen idx
    let [showPollModal,      setShowPollModal]      = useState(false);  // host poll creator
    let [pollQuestion,       setPollQuestion]       = useState('');
    let [pollOptions,        setPollOptions]        = useState(['', '']);

    // derived
    const isCoHost     = coHosts.includes(socketIdRef.current);
    const canModerate  = isHost || isCoHost;

    // ref mirrors
    useEffect(() => { isHostRef.current   = isHost;   }, [isHost]);
    useEffect(() => { audioRef.current    = audio;    }, [audio]);
    useEffect(() => { screenRef.current   = screen;   }, [screen]);
    useEffect(() => { usernameRef.current = username; }, [username]);

    // theme effect
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('dconnect-theme', theme);
    }, [theme]);

    useEffect(() => { getPermissions(); }, []);

    useEffect(() => {
        return () => {
            if (timerRef.current)         clearInterval(timerRef.current);
            if (speakingInterval.current) clearInterval(speakingInterval.current);
            if (recordingRAFRef.current)  cancelAnimationFrame(recordingRAFRef.current);
            if (noiseAudioCtxRef.current) { try { noiseAudioCtxRef.current.close(); } catch(e) {} }
            if (recognitionRef.current)   { try { recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch(e) {} }
            Object.values(analysersRef.current).forEach(({audioCtx}) => { try { audioCtx.close(); } catch(e) {} });
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
                } catch(e) {}
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
                try { analysersRef.current[id].audioCtx.close(); } catch(e) {}
                delete analysersRef.current[id];
            }
        });
    }, [videos]);

    useEffect(() => {
        videos.forEach(v => {
            const el = remoteVideoElsRef.current[v.socketId];
            if (el && v.stream && el.srcObject !== v.stream) el.srcObject = v.stream;
        });
    }, [videos]);

    // Fullscreen listener
    useEffect(() => {
        const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFSChange);
        return () => document.removeEventListener('fullscreenchange', onFSChange);
    }, []);

    // Connection quality polling — runs getStats() on each peer every 5s
    useEffect(() => {
        if (askForUsername) return;
        qualityInterval.current = setInterval(async () => {
            const quality = {};
            for (const [sid, pc] of Object.entries(connections)) {
                if (!pc?.getStats) continue;
                try {
                    const stats = await pc.getStats();
                    let rtt = null;
                    stats.forEach(report => {
                        if (report.type === 'candidate-pair' && report.state === 'succeeded'
                            && report.currentRoundTripTime !== undefined) {
                            rtt = report.currentRoundTripTime;
                        }
                    });
                    quality[sid] = rtt === null ? 4 : rtt < 0.1 ? 4 : rtt < 0.25 ? 3 : rtt < 0.5 ? 2 : 1;
                } catch(e) { quality[sid] = 3; }
            }
            setConnectionQuality(quality);
        }, 5000);
        return () => { if (qualityInterval.current) clearInterval(qualityInterval.current); };
    }, [askForUsername]);

    // Auto-scroll chat to bottom when new messages arrive (if user is near bottom)
    useEffect(() => {
        if (!showScrollBtn && chatBottomRef.current) {
            chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // keyboard shortcuts
    useEffect(() => {
        if (askForUsername) return;
        const handleKeyDown = (e) => {
            const tag = document.activeElement && document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.code === 'Space') {
                e.preventDefault();
                if (!e.repeat && !audio) { pushToTalkRef.current = true; setAudio(true); }
                return;
            }
            const key = e.key.toLowerCase();
            if      (key === 'm') handleAudio();
            else if (key === 'v') handleVideo();
            else if (key === 'c') { if (showChat) closeSidePanel(); else openSidePanel('chat'); }
            else if (key === 'f') { toggleFullscreen(); }
        };
        const handleKeyUp = (e) => {
            if (e.code === 'Space' && pushToTalkRef.current) { pushToTalkRef.current = false; setAudio(false); }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, [askForUsername, audio, video, showChat]);

    const startSpeakingDetection = (socketId, stream) => {
        try {
            if (analysersRef.current[socketId]) return;
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            audioCtx.createMediaStreamSource(stream).connect(analyser);
            analysersRef.current[socketId] = { audioCtx, analyser };
        } catch(e) {}
    };

    const addToast = (msg, type = 'join') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    };

    // ── NEW FEATURE FUNCTIONS ─────────────────────────────────────────────

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    };

    const toggleMirror = () => setMirrorVideo(p => !p);

    const handleChatScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 80);
    };

    const scrollToBottom = () => {
        if (chatBottomRef.current) chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
        setShowScrollBtn(false);
    };

    const insertEmoji = (emoji) => {
        setMessage(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    const createPoll = () => {
        const validOptions = pollOptions.filter(o => o.trim());
        if (!pollQuestion.trim() || validOptions.length < 2) return;
        const poll = { question: pollQuestion.trim(), options: validOptions };
        socketRef.current.emit('chat-message', `__POLL__:${JSON.stringify(poll)}`, username);
        setActivePoll(poll);
        setPollVotes({}); setMyVote(null);
        setShowPollModal(false); setPollQuestion(''); setPollOptions(['', '']);
    };

    const votePoll = (index) => {
        if (myVote !== null) return;
        setMyVote(index);
        socketRef.current.emit('chat-message', `__POLL_VOTE__:${index}`, username);
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

    // ── RECORDING ───────────────────────────────────────────────────────────
    const startRecording = () => {
        if (!isHost) return;
        try {
            const W = 1280, H = 720;
            const canvas = document.createElement('canvas');
            canvas.width = W; canvas.height = H;
            const ctx = canvas.getContext('2d');
            const drawFrame = () => {
                const feeds = [];
                if (localVideoref.current && localVideoref.current.readyState >= 2) {
                    feeds.push({ el: localVideoref.current, label: screenRef.current ? `${usernameRef.current} 🖥️ Screen` : `${usernameRef.current} (You)` });
                }
                Object.entries(remoteVideoElsRef.current).forEach(([sid, el]) => {
                    if (el && el.readyState >= 2) feeds.push({ el, label: participantNames[sid] || 'Participant' });
                });
                ctx.fillStyle = '#010430'; ctx.fillRect(0, 0, W, H);
                if (feeds.length > 0) {
                    const cols = feeds.length === 1 ? 1 : feeds.length <= 4 ? 2 : 3;
                    const rows = Math.ceil(feeds.length / cols);
                    const gap = 6, tileW = Math.floor((W - gap * (cols + 1)) / cols), tileH = Math.floor((H - gap * (rows + 1)) / rows);
                    feeds.forEach((feed, i) => {
                        const col = i % cols, row = Math.floor(i / cols);
                        const x = gap + col * (tileW + gap), y = gap + row * (tileH + gap);
                        ctx.fillStyle = '#0a0c28'; ctx.beginPath(); ctx.roundRect(x, y, tileW, tileH, 8); ctx.fill();
                        ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, tileW, tileH, 8); ctx.clip();
                        try { ctx.drawImage(feed.el, x, y, tileW, tileH); } catch(e) {}
                        ctx.restore();
                        ctx.font = 'bold 13px -apple-system, Arial, sans-serif';
                        const tw = Math.min(ctx.measureText(feed.label).width + 20, tileW - 16);
                        ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.beginPath(); ctx.roundRect(x + 8, y + tileH - 30, tw, 22, 5); ctx.fill();
                        ctx.fillStyle = '#fff'; ctx.fillText(feed.label, x + 16, y + tileH - 13, tileW - 24);
                    });
                }
                ctx.fillStyle = 'rgba(239,68,68,0.9)'; ctx.beginPath(); ctx.arc(W - 28, 20, 7, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.fillText('REC', W - 18, 25);
                recordingRAFRef.current = requestAnimationFrame(drawFrame);
            };
            drawFrame();
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const destination = audioCtx.createMediaStreamDestination();
            if (window.localStream) try { audioCtx.createMediaStreamSource(window.localStream).connect(destination); } catch(e) {}
            Object.values(remoteVideoElsRef.current).forEach(el => {
                if (el && el.srcObject) try { audioCtx.createMediaStreamSource(el.srcObject).connect(destination); } catch(e) {}
            });
            const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
            const recorder = new MediaRecorder(new MediaStream([...canvas.captureStream(24).getVideoTracks(), ...destination.stream.getAudioTracks()]), { mimeType: mime });
            recordedChunksRef.current = [];
            recorder.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
            recorder.onstop = () => {
                if (recordingRAFRef.current) { cancelAnimationFrame(recordingRAFRef.current); recordingRAFRef.current = null; }
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const url = URL.createObjectURL(blob), a = document.createElement('a');
                a.href = url; a.download = `DConnect-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.webm`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(url); try { audioCtx.close(); } catch(e) {}
            };
            mediaRecorderRef.current = recorder; recorder.start(1000);
            setIsRecording(true);
            socketRef.current.emit('chat-message', '__RECORDING_START__', username);
            addToast('Recording whole meeting ⏺', 'join');
        } catch(e) { addToast('Recording not supported', 'leave'); }
    };

    const stopRecording = () => {
        if (recordingRAFRef.current) { cancelAnimationFrame(recordingRAFRef.current); recordingRAFRef.current = null; }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
        setIsRecording(false);
        socketRef.current?.emit('chat-message', '__RECORDING_STOP__', username);
        addToast('Recording saved ✓', 'hand');
    };

    const handleRecording = () => { if (!isHost) return; if (isRecording) stopRecording(); else startRecording(); };
    const handlePin = (sid) => { setPinnedId(prev => prev === sid ? null : sid); };

    const playSound = (type) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const note = (freq, start, dur) => {
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.type = 'sine'; o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
                g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(0.18, start + 0.02);
                g.gain.exponentialRampToValueAtTime(0.001, start + dur); o.start(start); o.stop(start + dur + 0.05);
            };
            const t = ctx.currentTime;
            if (type === 'join')  { note(880, t, 0.18); note(1108, t+0.15, 0.22); }
            else if (type === 'leave') { note(660, t, 0.28); }
            else if (type === 'alert') { note(1046, t, 0.12); note(1046, t+0.18, 0.12); }
            setTimeout(() => { try { ctx.close(); } catch(e) {} }, 1500);
        } catch(e) {}
    };

    const enumerateDevices = async () => {
        try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const c = devs.filter(d => d.kind === 'videoinput'), m = devs.filter(d => d.kind === 'audioinput');
            setCameras(c); setMics(m);
            if (c.length) setSelectedCamera(p => p || c[0].deviceId);
            if (m.length) setSelectedMic(p => p || m[0].deviceId);
        } catch(e) {}
    };

    const switchDevice = async (deviceId, kind) => {
        try {
            const constraints = {
                video: kind === 'video' ? { deviceId: { exact: deviceId } } : (videoAvailable && lobbyVideoOn),
                audio: kind === 'audio' ? { deviceId: { exact: deviceId } } : (audioAvailable && lobbyAudioOn),
            };
            if (!constraints.video && !constraints.audio) return;
            if (window.localStream) (kind === 'video' ? window.localStream.getVideoTracks() : window.localStream.getAudioTracks()).forEach(t => t.stop());
            const ns = await navigator.mediaDevices.getUserMedia(constraints);
            const trk = kind === 'video' ? ns.getVideoTracks()[0] : ns.getAudioTracks()[0];
            if (trk) {
                trk.enabled = kind === 'video' ? lobbyVideoOn : lobbyAudioOn;
                const old = kind === 'video' ? window.localStream?.getVideoTracks() : window.localStream?.getAudioTracks();
                old?.forEach(t => window.localStream.removeTrack(t)); window.localStream.addTrack(trk);
                if (kind === 'video' && localVideoref.current) localVideoref.current.srcObject = window.localStream;
            }
        } catch(e) {}
    };

    // ── NOISE CANCELLATION ─────────────────────────────────────────────────
    const toggleNoiseCancellation = async () => {
        if (noiseCancellation) {
            // Restore original audio track
            if (originalAudioTrackRef.current && window.localStream) {
                const processed = window.localStream.getAudioTracks()[0];
                if (processed) window.localStream.removeTrack(processed);
                window.localStream.addTrack(originalAudioTrackRef.current);
                for (let id in connections) {
                    const senders = connections[id].getSenders?.() || [];
                    const as = senders.find(s => s.track?.kind === 'audio');
                    if (as) as.replaceTrack(originalAudioTrackRef.current).catch(() => {});
                }
            }
            if (noiseAudioCtxRef.current) { try { noiseAudioCtxRef.current.close(); } catch(e) {} noiseAudioCtxRef.current = null; }
            originalAudioTrackRef.current = null;
            setNoiseCancellation(false);
            addToast('Noise cancellation off', 'leave');
        } else {
            const origTrack = window.localStream?.getAudioTracks()[0];
            if (!origTrack) { addToast('No microphone available', 'leave'); return; }
            try {
                originalAudioTrackRef.current = origTrack;
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                noiseAudioCtxRef.current = ctx;
                const source = ctx.createMediaStreamSource(new MediaStream([origTrack]));
                // High-pass: cut rumble below 80Hz
                const highPass = ctx.createBiquadFilter(); highPass.type = 'highpass'; highPass.frequency.value = 80;
                // Low-pass: cut hiss above 8kHz
                const lowPass = ctx.createBiquadFilter(); lowPass.type = 'lowpass'; lowPass.frequency.value = 8000;
                // Compressor: suppress background noise, even out levels
                const comp = ctx.createDynamicsCompressor();
                comp.threshold.value = -40; comp.knee.value = 10; comp.ratio.value = 8;
                comp.attack.value = 0.003; comp.release.value = 0.1;
                const dest = ctx.createMediaStreamDestination();
                source.connect(highPass); highPass.connect(lowPass); lowPass.connect(comp); comp.connect(dest);
                const processedTrack = dest.stream.getAudioTracks()[0];
                window.localStream.removeTrack(origTrack); window.localStream.addTrack(processedTrack);
                for (let id in connections) {
                    const senders = connections[id].getSenders?.() || [];
                    const as = senders.find(s => s.track?.kind === 'audio');
                    if (as) as.replaceTrack(processedTrack).catch(() => {});
                }
                setNoiseCancellation(true);
                addToast('Noise cancellation on 🎙️', 'join');
            } catch(e) { addToast('Noise cancellation not supported', 'leave'); }
        }
    };

    // ── CO-HOSTS ──────────────────────────────────────────────────────────
    const makeCoHost = (targetId) => {
        socketRef.current.emit('chat-message', `__COHOST_ADD__:${targetId}`, username);
    };
    const removeCoHost = (targetId) => {
        socketRef.current.emit('chat-message', `__COHOST_REMOVE__:${targetId}`, username);
    };

    // ── WAITING ROOM ──────────────────────────────────────────────────────
    const toggleWaitingRoom = () => {
        const next = !waitingRoomEnabled;
        setWaitingRoomEnabled(next);
        socketRef.current.emit('set-waiting-room', window.location.href, next);
        addToast(next ? '⏳ Waiting room enabled' : 'Waiting room disabled', next ? 'hand' : 'join');
    };
    const admitUser = (socketId) => {
        socketRef.current.emit('admit-user', socketId, window.location.href);
        setWaitingParticipants(p => p.filter(w => w.socketId !== socketId));
        addToast(`Admitted ${participantNames[socketId] || 'participant'}`, 'join');
    };
    const denyUser = (socketId) => {
        socketRef.current.emit('deny-user', socketId, window.location.href);
        setWaitingParticipants(p => p.filter(w => w.socketId !== socketId));
        addToast(`Removed ${participantNames[socketId] || 'participant'} from waiting room`, 'leave');
    };

    // ── PRIVATE MESSAGES ──────────────────────────────────────────────────
    const sendMessage = () => {
        if (!message.trim()) return;
        if (privateTarget === 'all') {
            socketRef.current.emit('chat-message', message, username);
        } else {
            socketRef.current.emit('private-message', privateTarget, message, username);
            // Don't add to main messages — it's added via the echo from server
        }
        setMessage("");
    };

    // ── THEME ──────────────────────────────────────────────────────────────
    const toggleTheme = () => setTheme(p => p === 'dark' ? 'light' : 'dark');

    // ── HOST FUNCTIONS ─────────────────────────────────────────────────────
    const hostMuteMic      = (id) => { socketRef.current.emit('chat-message', `__HOST_MUTE_MIC__:${id}`, username); setRemoteStates(p => ({...p,[id]:{...p[id],micMuted:true}})); };
    const hostUnmuteMicReq = (id) => { socketRef.current.emit('chat-message', `__HOST_UNMUTE_REQ__:${id}`, username); };
    const hostMuteCamera   = (id) => { socketRef.current.emit('chat-message', `__HOST_MUTE_CAM__:${id}`, username);  setRemoteStates(p => ({...p,[id]:{...p[id],camOff:true}})); };
    const hostKick         = (id) => { socketRef.current.emit('chat-message', `__HOST_KICK__:${id}`, username); setConfirmKick(null); };
    const hostMuteAll      = ()   => {
        socketRef.current.emit('chat-message', '__HOST_MUTE_ALL__', username);
        const upd = {}; videos.forEach(v => { upd[v.socketId] = {...remoteStates[v.socketId], micMuted:true}; });
        setRemoteStates(p => ({...p,...upd})); addToast('All participants muted', 'hand');
    };
    const hostLockMeeting = () => {
        const next = !meetingLocked, path = window.location.href;
        setMeetingLocked(next);
        socketRef.current.emit('lock-room', path, next);
        addToast(next ? '🔒 Meeting locked' : '🔓 Meeting unlocked', next ? 'leave' : 'join');
    };
    const hostTransfer = (id) => {
        socketRef.current.emit('chat-message', `__HOST_TRANSFER__:${id}`, username);
        setIsHost(false); isHostRef.current = false; setHostSocketId(id);
        addToast('Host role transferred', 'hand');
    };

    // ── CAPTIONS ──────────────────────────────────────────────────────────
    const showCaptionBubble = (name, text) => {
        setActiveCaption({ name, text });
        if (captionClearTimeoutRef.current) clearTimeout(captionClearTimeoutRef.current);
        captionClearTimeoutRef.current = setTimeout(() => setActiveCaption(null), 4000);
    };

    const toggleCaptions = () => {
        const API = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!API) { addToast('Captions not supported in this browser', 'leave'); return; }
        if (captionsOn) {
            captionsOnRef.current = false;
            if (recognitionRef.current) { try { recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch(e) {} recognitionRef.current = null; }
            setCaptionsOn(false); setActiveCaption(null); return;
        }
        try {
            const r = new API();
            r.continuous = true; r.interimResults = true; r.lang = 'en-US';
            r.onresult = (ev) => {
                if (!audioRef.current) return;
                let interim = '', final = '';
                for (let i = ev.resultIndex; i < ev.results.length; i++) {
                    const t = ev.results[i][0].transcript;
                    if (ev.results[i].isFinal) final += t; else interim += t;
                }
                if (final.trim()) { showCaptionBubble(username, final.trim()); socketRef.current?.emit('chat-message', `__CAPTION__:${final.trim()}`, username); }
                else if (interim.trim()) showCaptionBubble(username, interim.trim());
            };
            r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { addToast('Mic access needed for captions', 'leave'); captionsOnRef.current = false; setCaptionsOn(false); } };
            r.onend = () => { if (captionsOnRef.current) try { r.start(); } catch(e) {} };
            recognitionRef.current = r; captionsOnRef.current = true;
            r.start(); setCaptionsOn(true); addToast('Captions turned on 💬', 'join');
        } catch(e) { addToast('Could not start captions', 'leave'); }
    };

    // ── MEDIA ──────────────────────────────────────────────────────────────
    const getPermissions = async () => {
        try {
            const vp = await navigator.mediaDevices.getUserMedia({ video: true }); setVideoAvailable(!!vp);
            const ap = await navigator.mediaDevices.getUserMedia({ audio: true }); setAudioAvailable(!!ap);
            setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
            if (videoAvailable || audioAvailable) {
                const qp = QUALITY_PRESETS[videoQuality] || QUALITY_PRESETS['720p'];
                const stream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable ? qp : false, audio: audioAvailable });
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
            navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
            .then(getDislayMediaSuccess)
            .catch(e => { console.log(e); setScreen(false); });
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

        // FIXED LOCK events
        socketRef.current.on('room-locked', () => { addToast('This meeting is locked 🔒', 'leave'); playSound('alert'); setTimeout(() => window.location.href = "/", 2000); });
        socketRef.current.on('room-lock-status', (locked) => { setMeetingLocked(locked); if (!isHostRef.current) addToast(locked ? '🔒 Meeting locked by host' : '🔓 Meeting unlocked', locked ? 'leave' : 'join'); });

        // NEW: WAITING ROOM events
        socketRef.current.on('waiting-room-queued', () => {
            setWaitingForAdmission(true);
            addToast('Waiting for host to admit you...', 'hand');
        });
        socketRef.current.on('waiting-room-status', (enabled) => { setWaitingRoomEnabled(enabled); });
        socketRef.current.on('user-waiting', (entry) => {
            setParticipantNames(p => ({...p,[entry.socketId]:entry.name}));
            setWaitingParticipants(p => [...p, entry]);
            playSound('alert');
            addToast(`${entry.name} is waiting to join ⏳`, 'hand');
        });
        socketRef.current.on('waiting-user-left', (socketId) => {
            setWaitingParticipants(p => p.filter(w => w.socketId !== socketId));
        });
        socketRef.current.on('waiting-room-denied', () => {
            addToast('You were not admitted to this meeting', 'leave');
            playSound('leave');
            setTimeout(() => window.location.href = "/", 2000);
        });

        // NEW: PRIVATE MESSAGE event
        socketRef.current.on('private-message', (data, sender, fromId) => {
            const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isOwn = fromId === socketIdRef.current;
            const entry = { sender: isOwn ? username : sender, data, timestamp: ts, isPrivate: true, fromId };
            setMessages(prev => [...prev, entry]);
            if (!isOwn) { setNewMessages(p => p + 1); addToast(`💬 Private message from ${sender}`, 'hand'); }
        });

        socketRef.current.on('connect', () => {
            setIsConnected(true);
            // Pass username to join-call for waiting room display
            socketRef.current.emit('join-call', window.location.href, usernameRef.current);
            socketIdRef.current = socketRef.current.id;
            socketRef.current.on('chat-message', addMessage);

            socketRef.current.on('user-left', (id) => {
                playSound('leave'); addToast('A participant left', 'leave');
                setPinnedId(p => p === id ? null : p);
                setCoHosts(p => p.filter(cid => cid !== id));
                setParticipantNames(p => { const n={...p}; delete n[id]; return n; });
                setRemoteStates(p => { const n={...p}; delete n[id]; return n; });
                delete remoteVideoElsRef.current[id];
                setVideos(vs => vs.filter(v => v.socketId !== id));
            });

            socketRef.current.on('user-joined', (id, clients) => {
                // If I was in waiting room and now I'm in user-joined, I was admitted
                if (id === socketIdRef.current) setWaitingForAdmission(false);

                if (id === socketIdRef.current && clients.length === 1) {
                    setIsHost(true); isHostRef.current = true; setHostSocketId(socketIdRef.current);
                    setTimeout(() => socketRef.current.emit('chat-message', `__HOST_CLAIM__:${socketIdRef.current}`, username), 400);
                }
                if (id !== socketIdRef.current) {
                    playSound('join'); addToast('A participant joined', 'join');
                    setTimeout(() => {
                        socketRef.current?.emit('chat-message', `__USERNAME__:${username}`, username);
                        if (isHostRef.current) socketRef.current?.emit('chat-message', `__HOST_CLAIM__:${socketIdRef.current}`, username);
                        // Re-announce co-hosts
                        coHosts.forEach(chId => { socketRef.current?.emit('chat-message', `__COHOST_ADD__:${chId}`, username); });
                    }, 400);
                } else {
                    setTimeout(() => socketRef.current?.emit('chat-message', `__USERNAME__:${username}`, username), 300);
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
    const handleScreen = () => {
        if (screen) {
            try { if (window.localStream) window.localStream.getVideoTracks().forEach(t => t.stop()); } catch(e) {}
        }
        setScreen(!screen);
    };

    useEffect(() => { if (screen !== undefined) getDislayMedia(); }, [screen]);

    const handleEndCall = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (isRecording) stopRecording();
        if (recordingRAFRef.current) { cancelAnimationFrame(recordingRAFRef.current); recordingRAFRef.current = null; }
        if (noiseCancellation && noiseAudioCtxRef.current) { try { noiseAudioCtxRef.current.close(); } catch(e) {} }
        if (captionsOnRef.current && recognitionRef.current) { try { recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch(e) {} }
        Object.values(analysersRef.current).forEach(({audioCtx}) => { try { audioCtx.close(); } catch(e) {} });
        analysersRef.current = {};
        try { localVideoref.current.srcObject.getTracks().forEach(t => t.stop()); } catch(e) {}
        window.location.href = "/";
    };

    const addMessage = (data, sender, socketIdSender) => {
        if (socketIdSender && sender && !data.startsWith('__')) setParticipantNames(p => ({...p,[socketIdSender]:sender}));

        if (data.startsWith('__USERNAME__:'))      { setParticipantNames(p=>({...p,[socketIdSender]:sender})); return; }
        if (data.startsWith('__HOST_CLAIM__:'))     { const id=data.replace('__HOST_CLAIM__:',''); setHostSocketId(id); if(id===socketIdRef.current){setIsHost(true);isHostRef.current=true;} return; }
        if (data.startsWith('__HOST_TRANSFER__:'))  { const nid=data.replace('__HOST_TRANSFER__:',''); setHostSocketId(nid); if(nid===socketIdRef.current){setIsHost(true);isHostRef.current=true;addToast('You are now the host 👑','hand');playSound('alert');}else if(socketIdSender===socketIdRef.current){setIsHost(false);isHostRef.current=false;} return; }
        if (data.startsWith('__HOST_MUTE_MIC__:'))  { const tid=data.replace('__HOST_MUTE_MIC__:',''); if(tid===socketIdRef.current){setAudio(false);if(window.localStream)window.localStream.getAudioTracks().forEach(t=>{t.enabled=false;});addToast('Host muted your microphone 🔇','leave');playSound('alert');} return; }
        if (data === '__HOST_MUTE_ALL__')            { if(socketIdSender!==socketIdRef.current){setAudio(false);if(window.localStream)window.localStream.getAudioTracks().forEach(t=>{t.enabled=false;});addToast('Host muted all microphones 🔇','leave');playSound('alert');} return; }
        if (data.startsWith('__HOST_UNMUTE_REQ__:')) { const tid=data.replace('__HOST_UNMUTE_REQ__:',''); if(tid===socketIdRef.current){addToast('Host is asking you to unmute 🎙️','hand');playSound('alert');} return; }
        if (data.startsWith('__HOST_MUTE_CAM__:'))   { const tid=data.replace('__HOST_MUTE_CAM__:',''); if(tid===socketIdRef.current){setVideo(false);if(window.localStream)window.localStream.getVideoTracks().forEach(t=>{t.enabled=false;});addToast('Host turned off your camera 📷','leave');playSound('alert');} return; }
        if (data.startsWith('__HOST_KICK__:'))        { const tid=data.replace('__HOST_KICK__:',''); if(tid===socketIdRef.current){addToast('You have been removed from the meeting','leave');playSound('leave');setTimeout(()=>handleEndCall(),800);} return; }
        if (data.startsWith('__HAND__:'))            { if(socketIdSender!==socketIdRef.current){const r=data.split(':')[1]==='true'; setRaisedHands(p=>({...p,[socketIdSender]:r})); if(r)addToast(`${sender} raised their hand ✋`,'hand');} return; }
        if (data.startsWith('__REACTION__:'))         { if(socketIdSender!==socketIdRef.current)triggerReaction(data.split(':')[1]); return; }
        if (data.startsWith('__CAPTION__:'))          { if(socketIdSender!==socketIdRef.current)showCaptionBubble(sender,data.replace('__CAPTION__:','')); return; }
        if (data === '__RECORDING_START__')           { if(socketIdSender!==socketIdRef.current){setIsRemoteRecording(true);addToast(`${sender} is recording ⏺`,'hand');} return; }
        if (data === '__RECORDING_STOP__')            { setIsRemoteRecording(false); return; }

        // NEW: POLLS
        if (data.startsWith('__POLL__:')) {
            try {
                const poll = JSON.parse(data.replace('__POLL__:', ''));
                setActivePoll(poll); setPollVotes({}); setMyVote(null);
                addToast('📊 A new poll has started!', 'hand');
            } catch(e) {}
            return;
        }
        if (data.startsWith('__POLL_VOTE__:')) {
            const idx = parseInt(data.replace('__POLL_VOTE__:', ''));
            if (!isNaN(idx)) setPollVotes(prev => ({...prev, [socketIdSender]: idx}));
            return;
        }

        // NEW: CO-HOST
        if (data.startsWith('__COHOST_ADD__:')) {
            const targetId = data.replace('__COHOST_ADD__:', '');
            setCoHosts(p => p.includes(targetId) ? p : [...p, targetId]);
            if (targetId === socketIdRef.current) { addToast('You are now a co-host 🌟', 'hand'); playSound('alert'); }
            else addToast(`${participantNames[targetId] || 'A participant'} is now co-host 🌟`, 'hand');
            return;
        }
        if (data.startsWith('__COHOST_REMOVE__:')) {
            const targetId = data.replace('__COHOST_REMOVE__:', '');
            setCoHosts(p => p.filter(id => id !== targetId));
            if (targetId === socketIdRef.current) addToast('Your co-host role was removed', 'leave');
            return;
        }

        setParticipantNames(p=>({...p,[socketIdSender]:sender}));
        setMessages(prev=>[...prev,{sender,data,timestamp:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),isPrivate:false}]);
        if (socketIdSender!==socketIdRef.current) setNewMessages(p=>p+1);
    };

    const connect    = () => { setAskForUsername(false); getMedia(); timerRef.current=setInterval(()=>setCallDuration(p=>p+1),1000); };
    const formatTime = (s) => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; };
    const getRoomName = () => { const p=window.location.pathname.split('/'); return p[p.length-1]||'Meeting'; };
    const handleInvite = () => { navigator.clipboard.writeText(getRoomName()); setInviteCopied(true); setTimeout(()=>setInviteCopied(false),2500); };

    const openSidePanel  = (panel) => { if(panel==='chat'){setShowChat(true);setShowParticipants(false);setNewMessages(0);}else{setShowParticipants(true);setShowChat(false);} };
    const closeSidePanel = () => { setShowChat(false); setShowParticipants(false); };
    const isSidePanelOpen = showChat || showParticipants;
    const getName = (sid) => participantNames[sid] || 'Participant';
    const pinnedVideo = videos.find(v => v.socketId === pinnedId);
    const otherVideos = videos.filter(v => v.socketId !== pinnedId);
    const getGridStyle = (count) => {
        if (count === 0) return {};
        const cols = count===1?1:count<=4?2:count<=9?3:4, rows = Math.ceil(count/cols);
        return { gridTemplateColumns:`repeat(${cols},1fr)`, gridTemplateRows:`repeat(${rows},1fr)` };
    };

    const darkFieldSx  = { flex:1,'& .MuiOutlinedInput-root':{color:'#fff',borderRadius:'12px','& fieldset':{borderColor:'rgba(255,255,255,0.15)'},'&:hover fieldset':{borderColor:'rgba(255,255,255,0.3)'},'&.Mui-focused fieldset':{borderColor:'#3b82f6'}},'& .MuiInputLabel-root':{color:'rgba(255,255,255,0.4)'},'& .MuiInputLabel-root.Mui-focused':{color:'#3b82f6'} };
    const lobbyFieldSx = { width:'100%','& .MuiOutlinedInput-root':{color:'#fff',borderRadius:'10px','& fieldset':{borderColor:'rgba(255,255,255,0.2)'},'&:hover fieldset':{borderColor:'rgba(255,255,255,0.4)'},'&.Mui-focused fieldset':{borderColor:'#3b82f6'}},'& .MuiInputLabel-root':{color:'rgba(255,255,255,0.5)'},'& .MuiInputLabel-root.Mui-focused':{color:'#3b82f6'} };

    return (
        <div>
        {askForUsername ? (
            /* ── LOBBY ── */
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
                    {/* Video quality selector */}
                    <div className={styles.deviceSelectGroup} style={{marginBottom:'4px'}}>
                        <label className={styles.deviceSelectLabel}>📹 Video Quality</label>
                        <div className={styles.deviceSelectWrapper}>
                            <select className={styles.deviceSelect} value={videoQuality}
                                onChange={e => setVideoQuality(e.target.value)}>
                                <option value="360p">360p — Low (saves bandwidth)</option>
                                <option value="720p">720p — Medium (recommended)</option>
                                <option value="1080p">1080p — High (fast connection)</option>
                            </select>
                        </div>
                    </div>
                    <div className={styles.lobbyForm}>
                        <TextField label="Your display name" value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==='Enter'&&username.trim()&&connect()} variant="outlined" sx={lobbyFieldSx}/>
                        <Button variant="contained" onClick={connect} disabled={!username.trim()} fullWidth sx={{mt:1.5,py:1.5,background:'#3b82f6','&:hover':{background:'#2563eb'},'&.Mui-disabled':{background:'rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.25)'},borderRadius:'10px',fontSize:'1rem',fontWeight:600,textTransform:'none',letterSpacing:0,boxShadow:'none'}}>
                            Join Now{(!lobbyVideoOn||!lobbyAudioOn)&&<span className={styles.joinHint}>{!lobbyVideoOn&&!lobbyAudioOn?' · No cam, no mic':!lobbyVideoOn?' · No camera':' · Muted'}</span>}
                        </Button>
                    </div>
                </div>
            </div>
        ) : waitingForAdmission ? (
            /* ── WAITING ROOM SCREEN ── */
            <div className={styles.waitingScreen}>
                <div className={styles.waitingCard}>
                    <HourglassEmptyIcon sx={{fontSize:'3.5rem',color:'#fbbf24',animation:'spin 2s linear infinite'}} />
                    <h2 className={styles.waitingTitle}>Waiting to be admitted</h2>
                    <p className={styles.waitingSubtitle}>The host will let you in soon</p>
                    <div className={styles.waitingUser}>
                        <span className={styles.waitingAvatar}>{username.charAt(0).toUpperCase()}</span>
                        <span className={styles.waitingName}>{username}</span>
                    </div>
                    <div className={styles.waitingDots}><span></span><span></span><span></span></div>
                    <button className={styles.waitingLeaveBtn} onClick={()=>window.location.href='/'}>Leave</button>
                </div>
            </div>
        ) : (
            /* ── MEETING ROOM ── */
            <div className={`${styles.meetVideoContainer} ${theme==='light'?styles.lightTheme:''}`}>

                {/* NAVBAR */}
                <div className={styles.navbar}>
                    <div className={styles.navLeft}>
                        <span className={styles.navBrand}>DConnect {isHost&&<span className={styles.hostCrown}>👑</span>}{isCoHost&&!isHost&&<span className={styles.coHostStar}>🌟</span>}</span>
                        <span className={styles.navRoom}>Room: {getRoomName()}</span>
                        {meetingLocked&&<span className={styles.lockBadge}>🔒 Locked</span>}
                        {waitingRoomEnabled&&<span className={styles.waitingBadge}>⏳ Waiting Room On</span>}
                    </div>
                    <div className={styles.navCenter}>
                        <span className={styles.navStatus}><span className={isConnected?styles.dotConnected:styles.dotConnecting}></span>{isConnected?'Connected':'Connecting...'}</span>
                        <span className={styles.navDivider}>|</span>
                        <span className={styles.navTimer}>{formatTime(callDuration)}</span>
                        {(isRecording||isRemoteRecording)&&<span className={styles.recNavBadge}>⏺ REC</span>}
                    </div>
                    <div className={styles.navRight}>
                        <span className={styles.navParticipants}>👥 {videos.length+1}{waitingParticipants.length>0&&<span className={styles.waitingCount}> +{waitingParticipants.length} waiting</span>}</span>
                        <button className={`${styles.navBtn} ${inviteCopied?styles.navBtnCopied:''}`} onClick={handleInvite}>{inviteCopied?`✓ Code: ${getRoomName()}`:`Invite`}</button>
                        <button className={styles.navBtn} onClick={()=>setShowQR(p=>!p)} title="Show QR code"><QrCode2Icon sx={{fontSize:'1rem',verticalAlign:'middle'}}/></button>
                        {canModerate&&<button className={`${styles.navBtn} ${meetingLocked?styles.navBtnLocked:''}`} onClick={hostLockMeeting}>{meetingLocked?'🔓 Unlock':'🔒 Lock'}</button>}
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

                {/* CAPTION BUBBLE */}
                {activeCaption&&(<div className={styles.captionBubble}><span className={styles.captionName}>{activeCaption.name}:</span> {activeCaption.text}</div>)}

                {/* SIDE PANEL */}
                {isSidePanelOpen&&(
                    <div className={styles.sidePanel}>
                        <div className={styles.sidePanelTabs}>
                            <button className={`${styles.sidePanelTab} ${showParticipants?styles.sidePanelTabActive:''}`} onClick={()=>openSidePanel('participants')}>
                                👥 People ({videos.length+1}){waitingParticipants.length>0&&<span className={styles.chatBadge}>{waitingParticipants.length}</span>}
                            </button>
                            <button className={`${styles.sidePanelTab} ${showChat?styles.sidePanelTabActive:''}`} onClick={()=>openSidePanel('chat')}>💬 Chat {newMessages>0&&!showChat&&<span className={styles.chatBadge}>{newMessages}</span>}</button>
                            <button className={styles.sidePanelClose} onClick={closeSidePanel}>✕</button>
                        </div>

                        {/* PARTICIPANTS TAB */}
                        {showParticipants&&(
                            <div className={styles.participantsContent}>
                                {/* Waiting participants section */}
                                {canModerate && waitingParticipants.length > 0 && (
                                    <div className={styles.waitingSection}>
                                        <div className={styles.waitingSectionTitle}>⏳ Waiting to join ({waitingParticipants.length})</div>
                                        {waitingParticipants.map(w=>(
                                            <div key={w.socketId} className={styles.waitingParticipantItem}>
                                                <span className={styles.participantAvatar}>{w.name.charAt(0).toUpperCase()}</span>
                                                <span className={styles.waitingParticipantName}>{w.name}</span>
                                                <div className={styles.waitingActions}>
                                                    <button className={styles.admitBtn} onClick={()=>admitUser(w.socketId)}>✓ Admit</button>
                                                    <button className={styles.denyBtn} onClick={()=>denyUser(w.socketId)}>✕ Deny</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {canModerate&&<div className={styles.hostBulkRow}><button className={styles.hostBulkBtn} onClick={hostMuteAll}>🔇 Mute All</button></div>}
                                {/* Me */}
                                <div className={styles.participantItem}>
                                    <div className={styles.participantInfo}>
                                        <span className={styles.participantAvatar}>{username.charAt(0).toUpperCase()}</span>
                                        <div>
                                            <span className={styles.participantName}>{username}
                                                {isHost&&<span className={styles.hostTag}>👑 Host</span>}
                                                {isCoHost&&!isHost&&<span className={styles.coHostTag}>🌟 Co-host</span>}
                                            </span>
                                            <span className={styles.participantYou}>(You)</span>
                                        </div>
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
                                                    <span className={styles.participantName}>{getName(v.socketId)}
                                                        {v.socketId===hostSocketId&&<span className={styles.hostTag}>👑</span>}
                                                        {coHosts.includes(v.socketId)&&<span className={styles.coHostTag}>🌟</span>}
                                                    </span>
                                                    {raisedHands[v.socketId]&&<span className={styles.handIndicator}>✋ Hand raised</span>}
                                                </div>
                                            </div>
                                            <div className={styles.participantStatus}>
                                                {remoteStates[v.socketId]?.micMuted?<MicOffIcon sx={{fontSize:'1rem',color:'#ef4444'}}/>:<MicIcon sx={{fontSize:'1rem',color:'rgba(255,255,255,0.4)'}}/>}
                                                {remoteStates[v.socketId]?.camOff?<VideocamOffIcon sx={{fontSize:'1rem',color:'#ef4444'}}/>:<VideocamIcon sx={{fontSize:'1rem',color:'rgba(255,255,255,0.4)'}}/>}
                                            </div>
                                            {canModerate&&(
                                                <div className={styles.hostParticipantActions}>
                                                    <button className={styles.hostActionBtn} onClick={()=>hostMuteMic(v.socketId)} title="Mute">🔇</button>
                                                    <button className={styles.hostActionBtn} onClick={()=>hostUnmuteMicReq(v.socketId)} title="Ask unmute">🎙️</button>
                                                    <button className={styles.hostActionBtn} onClick={()=>hostMuteCamera(v.socketId)} title="Cam off">📷</button>
                                                    {isHost&&!coHosts.includes(v.socketId)&&<button className={styles.hostActionBtn} onClick={()=>makeCoHost(v.socketId)} title="Make co-host">🌟</button>}
                                                    {isHost&&coHosts.includes(v.socketId)&&<button className={styles.hostActionBtn} onClick={()=>removeCoHost(v.socketId)} title="Remove co-host">⭐</button>}
                                                    {isHost&&<button className={styles.hostActionBtn} onClick={()=>hostTransfer(v.socketId)} title="Transfer host">👑</button>}
                                                    <button className={`${styles.hostActionBtn} ${styles.hostKickBtn}`} onClick={()=>setConfirmKick(v.socketId)} title="Remove">✕</button>
                                                </div>
                                            )}
                                        </div>
                                        {confirmKick===v.socketId&&(
                                            <div className={styles.kickConfirm}>
                                                <span>Remove {getName(v.socketId)}?</span>
                                                <button className={styles.kickConfirmYes} onClick={()=>hostKick(v.socketId)}>Remove</button>
                                                <button className={styles.kickConfirmNo} onClick={()=>setConfirmKick(null)}>Cancel</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* CHAT TAB */}
                        {showChat&&(
                            <div className={styles.chatContent}>
                                <div className={styles.chattingDisplay} ref={chatDisplayRef} onScroll={handleChatScroll}>
                                    {messages.length>0?messages.map((item,idx)=>{
                                        const own=item.sender===username;
                                        return(
                                            <div key={idx} className={`${styles.messageWrapper} ${own?styles.ownMessage:styles.otherMessage}`}>
                                                {!own&&<p className={styles.messageSender}>{item.sender}{item.isPrivate&&<span className={styles.privateBadge}>🔒 Private</span>}</p>}
                                                {own&&item.isPrivate&&<p className={styles.messageSender}><span className={styles.privateBadge}>🔒 Private to {getName(item.fromId||privateTarget)}</span></p>}
                                                <div className={`${styles.messageBubble} ${item.isPrivate?styles.privateBubble:''}`}><p className={styles.messageText}>{item.data}</p></div>
                                                {item.timestamp&&<p className={styles.messageTime}>{item.timestamp}</p>}
                                            </div>
                                        );
                                    }):<div className={styles.noMessages}><span>💬</span><p>No messages yet</p><p>Say hello!</p></div>}
                                </div>
                                {/* PRIVATE MESSAGE TARGET SELECTOR */}
                                {showScrollBtn&&(
                                    <button className={styles.scrollToBottomBtn} onClick={scrollToBottom}>
                                        ↓ New messages
                                    </button>
                                )}
                                {/* EMOJI PICKER */}
                                {showEmojiPicker&&(
                                    <div className={styles.emojiPickerContainer}>
                                        {EMOJI_LIST.map(e=>(
                                            <button key={e} className={styles.emojiPickerBtn} onClick={()=>insertEmoji(e)}>{e}</button>
                                        ))}
                                    </div>
                                )}
                                <div className={styles.privateTo}>
                                    <span className={styles.privateToLabel}>To:</span>
                                    <select className={styles.privateToSelect} value={privateTarget} onChange={e=>setPrivateTarget(e.target.value)}>
                                        <option value="all">Everyone</option>
                                        {videos.map(v=><option key={v.socketId} value={v.socketId}>{getName(v.socketId)}</option>)}
                                    </select>
                                    {privateTarget!=='all'&&<span className={styles.privateLock}>🔒</span>}
                                </div>
                                <div className={styles.chattingArea}>
                                    <TextField value={message} onChange={e=>setMessage(e.target.value)}
                                        onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}}
                                        label={privateTarget==='all'?'Message...':'Private message...'}
                                        variant="outlined" size="small" sx={darkFieldSx}/>
                                    <IconButton onClick={()=>setShowEmojiPicker(p=>!p)} sx={{color:showEmojiPicker?'#fbbf24':'rgba(255,255,255,0.4)','&:hover':{color:'#fbbf24'}}}>
                                        <span style={{fontSize:'1.2rem'}}>😊</span>
                                    </IconButton>
                                    <Button variant='contained' onClick={sendMessage} sx={{background:privateTarget==='all'?'#3b82f6':'#7c3aed','&:hover':{background:privateTarget==='all'?'#2563eb':'#6d28d9'},borderRadius:'12px',minWidth:'60px',textTransform:'none',fontWeight:600,boxShadow:'none',padding:'8px 14px',flexShrink:0}}>Send</Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* KEYBOARD SHORTCUTS MODAL */}
                {showShortcutsHelp&&(
                    <div className={styles.shortcutsOverlay} onClick={()=>setShowShortcutsHelp(false)}>
                        <div className={styles.shortcutsPanel} onClick={e=>e.stopPropagation()}>
                            <div className={styles.shortcutsPanelHeader}><span>Keyboard Shortcuts</span><button className={styles.chatCloseBtn} onClick={()=>setShowShortcutsHelp(false)}>✕</button></div>
                            <div className={styles.shortcutRow}><kbd className={styles.kbd}>M</kbd><span>Toggle microphone</span></div>
                            <div className={styles.shortcutRow}><kbd className={styles.kbd}>V</kbd><span>Toggle camera</span></div>
                            <div className={styles.shortcutRow}><kbd className={styles.kbd}>C</kbd><span>Toggle chat panel</span></div>
                            <div className={styles.shortcutRow}><kbd className={styles.kbd}>Space</kbd><span>Hold to talk (push-to-talk)</span></div>
                            <div className={styles.shortcutRow}><kbd className={styles.kbd}>F</kbd><span>Toggle fullscreen</span></div>
                        </div>
                    </div>
                )}

                {/* QR CODE MODAL */}
                {showQR&&(
                    <div className={styles.qrOverlay} onClick={()=>setShowQR(false)}>
                        <div className={styles.qrModal} onClick={e=>e.stopPropagation()}>
                            <div className={styles.qrHeader}>
                                <span>Scan to join</span>
                                <button className={styles.chatCloseBtn} onClick={()=>setShowQR(false)}>✕</button>
                            </div>
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.href)}`}
                                alt="QR Code" className={styles.qrImage}
                            />
                            <div className={styles.qrCode}>{getRoomName()}</div>
                            <p className={styles.qrHint}>Point a phone camera at the QR code to join instantly</p>
                        </div>
                    </div>
                )}

                {/* POLL CREATION MODAL (host only) */}
                {showPollModal&&(
                    <div className={styles.qrOverlay} onClick={()=>setShowPollModal(false)}>
                        <div className={styles.pollModal} onClick={e=>e.stopPropagation()}>
                            <div className={styles.qrHeader}>
                                <span>📊 Create a Poll</span>
                                <button className={styles.chatCloseBtn} onClick={()=>setShowPollModal(false)}>✕</button>
                            </div>
                            <input className={styles.pollInput} placeholder="Question..." value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} />
                            {pollOptions.map((opt,i)=>(
                                <div key={i} className={styles.pollOptionRow}>
                                    <input className={styles.pollInput} placeholder={`Option ${i+1}...`} value={opt} onChange={e=>{const n=[...pollOptions];n[i]=e.target.value;setPollOptions(n);}} />
                                    {pollOptions.length>2&&<button className={styles.pollRemoveBtn} onClick={()=>setPollOptions(p=>p.filter((_,idx)=>idx!==i))}>✕</button>}
                                </div>
                            ))}
                            {pollOptions.length<4&&<button className={styles.pollAddBtn} onClick={()=>setPollOptions(p=>[...p,''])}>+ Add option</button>}
                            <button className={styles.pollLaunchBtn} onClick={createPoll} disabled={!pollQuestion.trim()||pollOptions.filter(o=>o.trim()).length<2}>Launch Poll</button>
                        </div>
                    </div>
                )}

                {/* ACTIVE POLL — shown to all participants */}
                {activePoll&&(
                    <div className={styles.pollPanel}>
                        <div className={styles.pollQuestion}>📊 {activePoll.question}</div>
                        {activePoll.options.map((opt,i)=>{
                            const totalVotes = Object.keys(pollVotes).length;
                            const votes = Object.values(pollVotes).filter(v=>v===i).length;
                            const pct = totalVotes>0 ? Math.round(votes/totalVotes*100) : 0;
                            return(
                                <div key={i} className={styles.pollOption} onClick={()=>votePoll(i)}>
                                    <div className={`${styles.pollOptionBtn} ${myVote===i?styles.pollOptionSelected:''}`}>
                                        <span>{opt}</span>
                                        {myVote!==null&&<span className={styles.pollPct}>{pct}%</span>}
                                    </div>
                                    {myVote!==null&&<div className={styles.pollBar} style={{width:`${pct}%`}}></div>}
                                </div>
                            );
                        })}
                        {myVote===null&&<p className={styles.pollHint}>Tap an option to vote</p>}
                        {myVote!==null&&<p className={styles.pollHint}>{Object.keys(pollVotes).length} vote{Object.keys(pollVotes).length!==1?'s':''} so far</p>}
                        <button className={styles.pollCloseBtn} onClick={()=>setActivePoll(null)}>Dismiss</button>
                    </div>
                )}

                {/* CONTROL BAR */}
                <div className={styles.buttonContainers}>
                    <div className={styles.controlBar}>
                        <IconButton onClick={handleVideo} className={styles.controlBtn}>{video===true?<VideocamIcon/>:<VideocamOffIcon/>}</IconButton>
                        <IconButton onClick={handleEndCall} className={styles.endCallBtn}><CallEndIcon/></IconButton>
                        <IconButton onClick={handleAudio} className={styles.controlBtn}>{audio===true?<MicIcon/>:<MicOffIcon/>}</IconButton>
                        {screenAvailable===true&&<IconButton onClick={handleScreen} className={styles.controlBtn}>{screen===true?<ScreenShareIcon/>:<StopScreenShareIcon/>}</IconButton>}
                        <IconButton onClick={handleRaiseHand} className={`${styles.controlBtn} ${handRaised?styles.handBtn:''}`} title="Raise Hand"><span style={{fontSize:'1.25rem',lineHeight:1}}>✋</span></IconButton>
                        <div className={styles.reactionArea}>
                            {showReactions&&(<div className={styles.reactionPicker}>{REACTIONS.map(e=><button key={e} className={styles.reactionBtn} onClick={()=>sendReaction(e)}>{e}</button>)}</div>)}
                            <IconButton onClick={()=>setShowReactions(!showReactions)} className={`${styles.controlBtn} ${showReactions?styles.controlBtnActive:''}`} title="Reactions"><span style={{fontSize:'1.25rem',lineHeight:1}}>😊</span></IconButton>
                        </div>

                        {/* View toggle: grid / speaker */}
                        <IconButton onClick={()=>setViewMode(p=>p==='grid'?'speaker':'grid')} className={`${styles.controlBtn} ${viewMode==='speaker'?styles.controlBtnActive:''}`} title={viewMode==='grid'?'Speaker view':'Grid view'}>
                            {viewMode==='grid'?<ViewAgendaIcon/>:<GridViewIcon/>}
                        </IconButton>
                        {/* Mirror / flip local camera */}
                        <IconButton onClick={toggleMirror} className={`${styles.controlBtn} ${mirrorVideo?styles.controlBtnActive:''}`} title="Mirror camera"><FlipIcon/></IconButton>
                        {/* Fullscreen */}
                        <IconButton onClick={toggleFullscreen} className={styles.controlBtn} title="Fullscreen (F)">
                            {isFullscreen?<FullscreenExitIcon/>:<FullscreenIcon/>}
                        </IconButton>
                        {/* MORE MENU */}
                        <div className={styles.moreMenuArea}>
                            {showMoreMenu&&(
                                <div className={styles.moreMenu}>
                                    {isHost&&(
                                        <button className={styles.moreMenuItem} onClick={()=>{handleRecording();setShowMoreMenu(false);}}>
                                            {isRecording?<span className={styles.recordDot}></span>:<span style={{fontSize:'1.1rem'}}>⏺</span>}
                                            <span>{isRecording?'Stop Recording':'Record Meeting'}</span>
                                        </button>
                                    )}
                                    <button className={styles.moreMenuItem} onClick={()=>{toggleCaptions();setShowMoreMenu(false);}}>
                                        {captionsOn?<ClosedCaptionIcon/>:<ClosedCaptionOffIcon/>}
                                        <span>{captionsOn?'Captions: On':'Turn On Captions'}</span>
                                    </button>
                                    <button className={`${styles.moreMenuItem} ${noiseCancellation?styles.moreMenuItemActive:''}`} onClick={()=>{toggleNoiseCancellation();setShowMoreMenu(false);}}>
                                        {noiseCancellation?<WifiIcon/>:<WifiOffIcon/>}
                                        <span>{noiseCancellation?'Noise Cancel: On':'Noise Cancellation'}</span>
                                    </button>
                                    {canModerate&&(
                                        <button className={`${styles.moreMenuItem} ${waitingRoomEnabled?styles.moreMenuItemActive:''}`} onClick={()=>{toggleWaitingRoom();setShowMoreMenu(false);}}>
                                            <HourglassEmptyIcon/>
                                            <span>{waitingRoomEnabled?'Waiting Room: On':'Enable Waiting Room'}</span>
                                        </button>
                                    )}
                                    <button className={styles.moreMenuItem} onClick={()=>{toggleTheme();setShowMoreMenu(false);}}>
                                        {theme==='dark'?<LightModeIcon/>:<DarkModeIcon/>}
                                        <span>{theme==='dark'?'Switch to Light Mode':'Switch to Dark Mode'}</span>
                                    </button>
                                    {isHost&&(
                                        <button className={styles.moreMenuItem} onClick={()=>{setShowPollModal(true);setShowMoreMenu(false);}}>
                                            <BarChartIcon/><span>Create Poll</span>
                                        </button>
                                    )}
                                    <button className={styles.moreMenuItem} onClick={()=>{setShowShortcutsHelp(true);setShowMoreMenu(false);}}>
                                        <KeyboardIcon/><span>Keyboard Shortcuts</span>
                                    </button>
                                </div>
                            )}
                            <IconButton onClick={()=>setShowMoreMenu(!showMoreMenu)} className={`${styles.controlBtn} ${showMoreMenu?styles.controlBtnActive:''}`} title="More options">
                                <MoreVertIcon/>
                                {(isRecording||captionsOn||noiseCancellation)&&<span className={styles.moreActiveDot}></span>}
                            </IconButton>
                        </div>

                        <IconButton onClick={()=>isSidePanelOpen&&showParticipants?closeSidePanel():openSidePanel('participants')} className={`${styles.controlBtn} ${showParticipants?styles.controlBtnActive:''}`} title="Participants">
                            <Badge badgeContent={waitingParticipants.length} color="warning" sx={{'& .MuiBadge-badge':{fontSize:'0.6rem',minWidth:'16px',height:'16px'}}}><PeopleAltIcon/></Badge>
                        </IconButton>
                        <Badge badgeContent={!showChat?newMessages:0} max={99} color='error'>
                            <IconButton onClick={()=>isSidePanelOpen&&showChat?closeSidePanel():openSidePanel('chat')} className={`${styles.controlBtn} ${showChat?styles.controlBtnActive:''}`} title="Chat"><ChatIcon/></IconButton>
                        </Badge>
                    </div>
                </div>

                {/* LOCAL VIDEO */}
                <div className={styles.localVideoWrapper}>
                    <video className={`${styles.meetUserVideo} ${speaking['local']?styles.speakingVideo:''}`} ref={localVideoref} autoPlay muted style={{transform:mirrorVideo?'scaleX(-1)':'scaleX(1)'}}></video>
                    <span className={styles.youLabel}>{screen?'🖥️ You':isHost?'You 👑':isCoHost?'You 🌟':'You'}</span>
                    {handRaised&&<span className={styles.handBadgeLocal}>✋</span>}
                    {isRecording&&<span className={styles.recordingBadge}>⏺ REC</span>}
                    {noiseCancellation&&<span className={styles.noiseBadge}>🎙️ NC</span>}
                </div>

                {/* EMPTY STATE */}
                {videos.length===0&&(<div className={styles.emptyState}><div className={styles.emptyPulse}></div><p className={styles.emptyTitle}>Waiting for others to join...</p><p className={styles.emptySub}>Share code <strong>{getRoomName()}</strong> to invite</p></div>)}

                {/* TILES */}
                {pinnedVideo?(
                    <div className={styles.conferenceViewSpotlight}>
                        <div className={`${styles.pinnedTile} ${speaking[pinnedVideo.socketId]?styles.speakingTile:''}`} onClick={()=>handlePin(pinnedVideo.socketId)}>
                            <video data-socket={pinnedVideo.socketId} ref={ref=>{if(ref){remoteVideoElsRef.current[pinnedVideo.socketId]=ref;if(pinnedVideo.stream&&ref.srcObject!==pinnedVideo.stream)ref.srcObject=pinnedVideo.stream;}}} autoPlay></video>
                            {raisedHands[pinnedVideo.socketId]&&<span className={styles.handBadge}>✋</span>}
                            <span className={styles.pinnedLabel}>📌 {getName(pinnedVideo.socketId)} — click to unpin</span>
                        </div>
                        {otherVideos.length>0&&(
                            <div className={styles.thumbnailStrip}>
                                {otherVideos.map(v=>(
                                    <div key={v.socketId} className={`${styles.thumbnailTile} ${speaking[v.socketId]?styles.thumbnailSpeaking:''}`} onClick={()=>handlePin(v.socketId)}>
                                        <video data-socket={v.socketId} ref={ref=>{if(ref){remoteVideoElsRef.current[v.socketId]=ref;if(v.stream&&ref.srcObject!==v.stream)ref.srcObject=v.stream;}}} autoPlay></video>
                                        {raisedHands[v.socketId]&&<span className={styles.handBadgeSm}>✋</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ):(
                    <div className={styles.conferenceView} style={getGridStyle(videos.length)}>
                        {videos.map(v=>(
                            <div key={v.socketId} className={`${styles.participantTile} ${speaking[v.socketId]?styles.speakingTile:''}`}>
                                <video data-socket={v.socketId} ref={ref=>{if(ref){remoteVideoElsRef.current[v.socketId]=ref;if(v.stream&&ref.srcObject!==v.stream)ref.srcObject=v.stream;}}} autoPlay></video>
                                {raisedHands[v.socketId]&&<span className={styles.handBadge}>✋</span>}
                                {v.socketId===hostSocketId&&<span className={styles.tileHostBadge}>👑</span>}
                                {coHosts.includes(v.socketId)&&<span className={styles.tileCoHostBadge}>🌟</span>}
                                <span className={styles.tileName}>{getName(v.socketId)}</span>
                                <span className={styles.pinHint} onClick={()=>handlePin(v.socketId)}>📌</span>
                                {/* Connection quality bars */}
                                <div className={styles.qualityBars}>
                                    {[1,2,3,4].map(level=>(
                                        <div key={level} className={`${styles.qualityBar} ${(connectionQuality[v.socketId]||4)>=level?styles.qualityBarActive:''}`}
                                            style={{height:`${level*4+4}px`, background:(connectionQuality[v.socketId]||4)>=4?'#22c55e':(connectionQuality[v.socketId]||4)>=3?'#84cc16':(connectionQuality[v.socketId]||4)>=2?'#f59e0b':'#ef4444'}}
                                        ></div>
                                    ))}
                                </div>
                                {canModerate&&(
                                    <div className={styles.hostTileOverlay}>
                                        <button className={styles.hostTileBtn} onClick={()=>hostMuteMic(v.socketId)}>🔇</button>
                                        <button className={styles.hostTileBtn} onClick={()=>hostMuteCamera(v.socketId)}>📷</button>
                                        <button className={`${styles.hostTileBtn} ${styles.hostTileKick}`} onClick={()=>setConfirmKick(v.socketId)}>✕</button>
                                    </div>
                                )}
                                {confirmKick===v.socketId&&(
                                    <div className={styles.kickConfirmOverlay}>
                                        <p>Remove {getName(v.socketId)}?</p>
                                        <button className={styles.kickConfirmYes} onClick={()=>hostKick(v.socketId)}>Yes, Remove</button>
                                        <button className={styles.kickConfirmNo} onClick={()=>setConfirmKick(null)}>Cancel</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* SPEAKER VIEW — auto-follows active speaker */}
                {viewMode==='speaker'&&!pinnedVideo&&videos.length>0&&(()=>{
                    const speakerSid = Object.keys(speaking).find(id=>id!=='local'&&speaking[id]&&videos.find(v=>v.socketId===id)) || videos[0].socketId;
                    const speakerV   = videos.find(v=>v.socketId===speakerSid);
                    const restV      = videos.filter(v=>v.socketId!==speakerSid);
                    return(
                        <div className={styles.conferenceViewSpotlight} style={{display:pinnedVideo?'none':'flex'}}>
                            <div className={`${styles.pinnedTile} ${speaking[speakerSid]?styles.speakingTile:''}`}>
                                <video data-socket={speakerSid} ref={ref=>{if(ref){remoteVideoElsRef.current[speakerSid]=ref;if(speakerV?.stream&&ref.srcObject!==speakerV.stream)ref.srcObject=speakerV.stream;}}} autoPlay></video>
                                <span className={styles.pinnedLabel}>🎤 {getName(speakerSid)}</span>
                                {raisedHands[speakerSid]&&<span className={styles.handBadge}>✋</span>}
                            </div>
                            {restV.length>0&&(
                                <div className={styles.thumbnailStrip}>
                                    {restV.map(v=>(
                                        <div key={v.socketId} className={`${styles.thumbnailTile} ${speaking[v.socketId]?styles.thumbnailSpeaking:''}`} onClick={()=>{setViewMode('grid');}}>
                                            <video data-socket={v.socketId} ref={ref=>{if(ref){remoteVideoElsRef.current[v.socketId]=ref;if(v.stream&&ref.srcObject!==v.stream)ref.srcObject=v.stream;}}} autoPlay></video>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* REACTIONS */}
                {activeReactions.map(r=>(<div key={r.id} className={styles.floatingReaction} style={{left:`${r.x}%`}}>{r.emoji}</div>))}

            </div>
        )}
        </div>
    );
}
