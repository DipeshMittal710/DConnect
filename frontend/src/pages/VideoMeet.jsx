import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField } from '@mui/material';
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import ClosedCaptionIcon from '@mui/icons-material/ClosedCaption';
import ClosedCaptionOffIcon from '@mui/icons-material/ClosedCaptionOff';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import FlipIcon from '@mui/icons-material/Flip';
import BarChartIcon from '@mui/icons-material/BarChart';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import GridViewIcon from '@mui/icons-material/GridView';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LockIcon from '@mui/icons-material/Lock';
import server from '../environment';

const server_url = server;
const REACTIONS   = ['👍','❤️','😂','🎉','🔥'];
const EMOJI_LIST  = ['😀','😂','😍','😎','🤔','😢','😡','🥳','👍','👎','❤️','🔥','🎉','💯','🙏','👏','🤝','💪','✅','❌','⭐','🚀','💡','📢','🎯','🎶','🍕','☕','🌟','💎'];
const QUALITY_PRESETS = {
    '360p':  { width:640,  height:360,  frameRate:15 },
    '720p':  { width:1280, height:720,  frameRate:24 },
    '1080p': { width:1920, height:1080, frameRate:30 },
};

// TURN server configuration.
// Same-network calls work with STUN alone.
// Cross-network calls (phone on LTE ↔ laptop on WiFi) REQUIRE a TURN relay.
//
// Option A — instant, no sign-up (public OpenRelay, good for demos):
//   Leave env vars empty — the public relay below is used automatically.
//
// Option B — private credentials (recommended for production):
//   Sign up free at https://dashboard.metered.ca, then add to frontend .env:
//     REACT_APP_TURN_URL=turn:YOURREGION.relay.metered.ca:80
//     REACT_APP_TURN_URL_2=turn:YOURREGION.relay.metered.ca:443?transport=tcp
//     REACT_APP_TURN_USERNAME=your_username
//     REACT_APP_TURN_CREDENTIAL=your_credential
const buildIceServers = () => {
    const customUser = process.env.REACT_APP_TURN_USERNAME;
    const customCred = process.env.REACT_APP_TURN_CREDENTIAL;
    const servers = [
        // Multiple Google STUN servers for faster ICE gathering
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
        // Public OpenRelay TURN — works out of the box for demos/student projects
        // Handles phone-on-LTE ↔ laptop-on-WiFi and all other cross-NAT scenarios
        {
            urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turn:openrelay.metered.ca:443?transport=tcp',
                'turn:openrelay.metered.ca:80?transport=tcp',
            ],
            username:   customUser || 'openrelayproject',
            credential: customCred || 'openrelayproject',
        },
    ];
    // Override / add private TURN if env vars are set
    if (process.env.REACT_APP_TURN_URL) {
        servers.push({ urls: process.env.REACT_APP_TURN_URL, username: customUser || '', credential: customCred || '' });
    }
    if (process.env.REACT_APP_TURN_URL_2) {
        servers.push({ urls: process.env.REACT_APP_TURN_URL_2, username: customUser || '', credential: customCred || '' });
    }
    return servers;
};
const peerConfig = { iceServers: buildIceServers(), iceCandidatePoolSize: 10 };

// module-level peer connections map
const connections = {};

export default function VideoMeetComponent() {

    const socketRef           = useRef();
    const socketIdRef         = useRef();
    const localVideoref       = useRef();
    const timerRef            = useRef(null);
    const analysersRef        = useRef({});
    const speakingInterval    = useRef(null);
    const mediaRecorderRef    = useRef(null);
    const recordedChunksRef   = useRef([]);
    const recordingRAFRef     = useRef(null);
    const remoteVideoElsRef   = useRef({});
    const isHostRef           = useRef(false);
    const recognitionRef      = useRef(null);
    const captionsOnRef       = useRef(false);
    const audioRef            = useRef(false);
    const captionClearRef     = useRef(null);
    const pushToTalkRef       = useRef(false);
    const screenRef           = useRef(false);
    const usernameRef         = useRef('');
    const noiseAudioCtxRef    = useRef(null);
    const originalAudioRef    = useRef(null);
    const chatBottomRef       = useRef(null);
    const chatDisplayRef      = useRef(null);
    const qualityIntervalRef  = useRef(null);
    // FIX #6: ICE candidate queuing — candidates that arrive before remote description is set
    const iceCandidateQueues  = useRef({});
    // Track the current video track so we can restore it after screen share
    const cameraTrackRef      = useRef(null);

    const videoRef = useRef([]);

    // ── STATE ──────────────────────────────────────────────────────────────
    const [videoAvailable,   setVideoAvailable]   = useState(true);
    const [audioAvailable,   setAudioAvailable]   = useState(true);
    const [video,            setVideo]            = useState(false);
    const [audio,            setAudio]            = useState(false);
    const [screen,           setScreen]           = useState(false);
    const [screenAvailable,  setScreenAvailable]  = useState(false);
    const [messages,         setMessages]         = useState([]);
    const [message,          setMessage]          = useState('');
    const [newMessages,      setNewMessages]      = useState(0);
    const [askForUsername,   setAskForUsername]   = useState(true);
    const [username,         setUsername]         = useState('');
    const [videos,           setVideos]           = useState([]);
    const [callDuration,     setCallDuration]     = useState(0);
    const [isConnected,      setIsConnected]      = useState(false);
    const [inviteCopied,     setInviteCopied]     = useState(false);
    const [speaking,         setSpeaking]         = useState({});
    const [toasts,           setToasts]           = useState([]);
    const [handRaised,       setHandRaised]       = useState(false);
    const [raisedHands,      setRaisedHands]      = useState({});
    const [showReactions,    setShowReactions]    = useState(false);
    const [activeReactions,  setActiveReactions]  = useState([]);
    const [lobbyVideoOn,     setLobbyVideoOn]     = useState(true);
    const [lobbyAudioOn,     setLobbyAudioOn]     = useState(true);
    const [pinnedId,         setPinnedId]         = useState(null);
    const [cameras,          setCameras]          = useState([]);
    const [mics,             setMics]             = useState([]);
    const [selectedCamera,   setSelectedCamera]   = useState('');
    const [selectedMic,      setSelectedMic]      = useState('');
    const [isHost,           setIsHost]           = useState(false);
    const [hostSocketId,     setHostSocketId]     = useState(null);
    const [meetingLocked,    setMeetingLocked]    = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [showChat,         setShowChat]         = useState(false);
    const [participantNames, setParticipantNames] = useState({});
    const [remoteStates,     setRemoteStates]     = useState({});
    const [confirmKick,      setConfirmKick]      = useState(null);
    const [isRecording,      setIsRecording]      = useState(false);
    const [isRemoteRecording,setIsRemoteRecording]= useState(false);
    const [captionsOn,       setCaptionsOn]       = useState(false);
    const [activeCaption,    setActiveCaption]    = useState(null);
    const [showShortcutsHelp,setShowShortcutsHelp]= useState(false);
    const [showMoreMenu,     setShowMoreMenu]     = useState(false);
    const [coHosts,          setCoHosts]          = useState([]);
    const [waitingRoomEnabled,setWaitingRoomEnabled]=useState(false);
    const [waitingParticipants,setWaitingParticipants]=useState([]);
    const [waitingForAdmission,setWaitingForAdmission]=useState(false);
    const [noiseCancellation, setNoiseCancellation]=useState(false);
    const [privateTarget,    setPrivateTarget]    = useState('all');
    const [theme,            setTheme]            = useState(() => localStorage.getItem('dconnect-theme')||'dark');
    const [mirrorVideo,      setMirrorVideo]      = useState(true);
    const [isFullscreen,     setIsFullscreen]     = useState(false);
    const [showScrollBtn,    setShowScrollBtn]    = useState(false);
    const [viewMode,         setViewMode]         = useState('grid');
    const [videoQuality,     setVideoQuality]     = useState('720p');
    const [connectionQuality,setConnectionQuality]= useState({});
    const [showQR,           setShowQR]           = useState(false);
    const [showEmojiPicker,  setShowEmojiPicker]  = useState(false);
    const [activePoll,       setActivePoll]       = useState(null);
    const [pollVotes,        setPollVotes]        = useState({});
    const [myVote,           setMyVote]           = useState(null);
    const [showPollModal,    setShowPollModal]    = useState(false);
    const [pollQuestion,     setPollQuestion]     = useState('');
    const [pollOptions,      setPollOptions]      = useState(['','']);

    // ── DERIVED ───────────────────────────────────────────────────────────
    const isCoHost    = coHosts.includes(socketIdRef.current);
    const canModerate = isHost || isCoHost;

    // ── REF MIRRORS ───────────────────────────────────────────────────────
    useEffect(() => { isHostRef.current  = isHost;   }, [isHost]);
    useEffect(() => { audioRef.current   = audio;    }, [audio]);
    useEffect(() => { screenRef.current  = screen;   }, [screen]);
    useEffect(() => { usernameRef.current= username; }, [username]);
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('dconnect-theme', theme);
    }, [theme]);

    // ── INIT ─────────────────────────────────────────────────────────────
    useEffect(() => { getPermissions(); }, []);

    // ── CLEANUP ON UNMOUNT ────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (timerRef.current)         clearInterval(timerRef.current);
            if (speakingInterval.current) clearInterval(speakingInterval.current);
            if (recordingRAFRef.current)  cancelAnimationFrame(recordingRAFRef.current);
            if (qualityIntervalRef.current) clearInterval(qualityIntervalRef.current);
            if (noiseAudioCtxRef.current) { try { noiseAudioCtxRef.current.close(); } catch(e){} }
            if (recognitionRef.current)   { try { recognitionRef.current.onend=null; recognitionRef.current.stop(); } catch(e){} }
            Object.values(analysersRef.current).forEach(({audioCtx}) => { try { audioCtx.close(); } catch(e){} });
            // FIX #19: proper socket + peer connection cleanup
            try { if (socketRef.current) { socketRef.current.removeAllListeners(); socketRef.current.disconnect(); } } catch(e){}
            try { Object.values(connections).forEach(pc => { try { pc.close(); } catch(e){} }); } catch(e){}
        };
    }, []);

    // ── SPEAKING DETECTION ────────────────────────────────────────────────
    useEffect(() => {
        speakingInterval.current = setInterval(() => {
            const arr = new Uint8Array(128);
            const next = {};
            for (const [id, { analyser }] of Object.entries(analysersRef.current)) {
                try { analyser.getByteFrequencyData(arr); next[id] = arr.reduce((a,b)=>a+b,0)/arr.length > 15; } catch(e){}
            }
            setSpeaking(prev => {
                const changed = Object.keys(next).length !== Object.keys(prev).length ||
                    Object.entries(next).some(([k,v]) => prev[k] !== v);
                return changed ? next : prev;
            });
        }, 100);
        return () => clearInterval(speakingInterval.current);
    }, []);

    // ── SYNC REMOTE VIDEO srcObject when stream changes ───────────────────
    useEffect(() => {
        videos.forEach(v => {
            const el = remoteVideoElsRef.current[v.socketId];
            if (el && v.stream && el.srcObject !== v.stream) el.srcObject = v.stream;
        });
    }, [videos]);

    // ── SPEAKING ANALYSER CLEANUP ─────────────────────────────────────────
    useEffect(() => {
        videos.forEach(v => {
            if (v.stream && !analysersRef.current[v.socketId]) startSpeaking(v.socketId, v.stream);
        });
        Object.keys(analysersRef.current).forEach(id => {
            if (id !== 'local' && !videos.find(v => v.socketId === id)) {
                try { analysersRef.current[id].audioCtx.close(); } catch(e){}
                delete analysersRef.current[id];
            }
        });
    }, [videos]);

    // ── FULLSCREEN LISTENER ───────────────────────────────────────────────
    useEffect(() => {
        const fn = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', fn);
        return () => document.removeEventListener('fullscreenchange', fn);
    }, []);

    // ── CONNECTION QUALITY POLLING ────────────────────────────────────────
    useEffect(() => {
        if (askForUsername) return;
        qualityIntervalRef.current = setInterval(async () => {
            const q = {};
            for (const [sid, pc] of Object.entries(connections)) {
                if (!pc?.getStats) continue;
                try {
                    const stats = await pc.getStats();
                    let rtt = null;
                    stats.forEach(r => {
                        if (r.type==='candidate-pair' && r.state==='succeeded' && r.currentRoundTripTime!==undefined) rtt = r.currentRoundTripTime;
                    });
                    q[sid] = rtt===null ? 4 : rtt<0.1 ? 4 : rtt<0.25 ? 3 : rtt<0.5 ? 2 : 1;
                } catch(e) { q[sid] = 3; }
            }
            setConnectionQuality(q);
        }, 5000);
        return () => { if (qualityIntervalRef.current) clearInterval(qualityIntervalRef.current); };
    }, [askForUsername]);

    // ── CHAT AUTO-SCROLL ──────────────────────────────────────────────────
    useEffect(() => {
        if (!showScrollBtn && chatBottomRef.current) chatBottomRef.current.scrollIntoView({ behavior:'smooth' });
    }, [messages]);

    // ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────
    useEffect(() => {
        if (askForUsername) return;
        const kd = (e) => {
            const tag = document.activeElement?.tagName;
            if (tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') return;
            if (e.code==='Space') { e.preventDefault(); if (!e.repeat && !audio) { pushToTalkRef.current=true; setAudio(true); } return; }
            const k = e.key.toLowerCase();
            if (k==='m') handleAudio();
            else if (k==='v') handleVideo();
            else if (k==='c') { if (showChat) closeSidePanel(); else openSidePanel('chat'); }
            else if (k==='f') toggleFullscreen();
        };
        const ku = (e) => { if (e.code==='Space' && pushToTalkRef.current) { pushToTalkRef.current=false; setAudio(false); } };
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup',   ku);
        return () => { window.removeEventListener('keydown',kd); window.removeEventListener('keyup',ku); };
    }, [askForUsername, audio, video, showChat]);

    // ── HELPERS ──────────────────────────────────────────────────────────
    const startSpeaking = (socketId, stream) => {
        try {
            if (analysersRef.current[socketId]) return;
            const ctx = new (window.AudioContext||window.webkitAudioContext)();
            const an  = ctx.createAnalyser(); an.fftSize = 512;
            ctx.createMediaStreamSource(stream).connect(an);
            analysersRef.current[socketId] = { audioCtx:ctx, analyser:an };
        } catch(e){}
    };

    const addToast = (msg, type='join') => {
        const id = Date.now()+Math.random();
        setToasts(p => [...p, {id, msg, type}]);
        setTimeout(() => setToasts(p => p.filter(t => t.id!==id)), 3500);
    };

    const playSound = (type) => {
        try {
            const ctx = new (window.AudioContext||window.webkitAudioContext)();
            const n = (freq, start, dur) => {
                const o=ctx.createOscillator(), g=ctx.createGain();
                o.type='sine'; o.frequency.value=freq; o.connect(g); g.connect(ctx.destination);
                g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(0.18, start+0.02);
                g.gain.exponentialRampToValueAtTime(0.001, start+dur); o.start(start); o.stop(start+dur+0.05);
            };
            const t = ctx.currentTime;
            if (type==='join')  { n(880,t,0.18); n(1108,t+0.15,0.22); }
            else if (type==='leave') { n(660,t,0.28); }
            else if (type==='alert') { n(1046,t,0.12); n(1046,t+0.18,0.12); }
            setTimeout(() => { try { ctx.close(); } catch(e){} }, 1500);
        } catch(e){}
    };

    // FIX #3 + #7: Create a black video track for when camera is off
    // Remote peers see black frames instead of a frozen last frame
    // FIX: keep canvas in a ref so it's not garbage-collected — GC'd canvas
    // stops sending frames and the remote peer sees a frozen black screen
    const createBlackVideoTrack = () => {
        if (blackTrackInterval.current) { clearInterval(blackTrackInterval.current); blackTrackInterval.current = null; }
        if (!blackCanvasRef.current) {
            blackCanvasRef.current = document.createElement('canvas');
            blackCanvasRef.current.width = 640; blackCanvasRef.current.height = 480;
        }
        const ctx = blackCanvasRef.current.getContext('2d');
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
        // Re-draw periodically — canvas.captureStream needs activity to keep sending
        blackTrackInterval.current = setInterval(() => {
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
        }, 100);
        return blackCanvasRef.current.captureStream(10).getVideoTracks()[0];
    };

    const createSilenceTrack = () => {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const dst = osc.connect(ctx.createMediaStreamDestination());
        osc.start(); ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
    };

    // FIX #7: Replace a track on all active peer connections without renegotiation
    const replaceTrackOnAllPeers = (kind, newTrack) => {
        for (const id in connections) {
            try {
                const senders = connections[id].getSenders?.() || [];
                const s = senders.find(s => s.track?.kind === kind);
                if (s) s.replaceTrack(newTrack).catch(e => console.log('replaceTrack error:', e));
            } catch(e){}
        }
    };

    // ── GETPERMISSIONS: single request ────────────────────────────────────
    const getPermissions = async () => {
        try {
            const qp = QUALITY_PRESETS[videoQuality] || QUALITY_PRESETS['720p'];
            const stream = await navigator.mediaDevices.getUserMedia({ video: qp, audio: true });
            setVideoAvailable(true); setAudioAvailable(true);
            setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
            window.localStream = stream;
            // Keep camera track ref so we can restore it after screen share
            cameraTrackRef.current = stream.getVideoTracks()[0] || null;
            if (localVideoref.current) localVideoref.current.srcObject = stream;
        } catch(e) {
            try { const s = await navigator.mediaDevices.getUserMedia({ video: QUALITY_PRESETS['720p'] }); setVideoAvailable(true); window.localStream=s; cameraTrackRef.current=s.getVideoTracks()[0]||null; if(localVideoref.current) localVideoref.current.srcObject=s; } catch(e2){ setVideoAvailable(false); }
            try { await navigator.mediaDevices.getUserMedia({ audio:true }); setAudioAvailable(true); } catch(e2){ setAudioAvailable(false); }
            setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
        }
        await enumerateDevices();
    };

    const enumerateDevices = async () => {
        try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const c = devs.filter(d=>d.kind==='videoinput'), m = devs.filter(d=>d.kind==='audioinput');
            setCameras(c); setMics(m);
            if (c.length) setSelectedCamera(p=>p||c[0].deviceId);
            if (m.length) setSelectedMic(p=>p||m[0].deviceId);
        } catch(e){}
    };

    // ── TOGGLE CAMERA: replaceTrack — no stream replacement ──────────────
    // FIX #3 & #8: Camera toggle uses replaceTrack instead of getUserMedia
    const handleVideo = async () => {
        const next = !video;
        setVideo(next);
        if (next) {
            // Turn camera ON: get camera track and replace black track
            try {
                const qp = QUALITY_PRESETS[videoQuality] || QUALITY_PRESETS['720p'];
                const s = await navigator.mediaDevices.getUserMedia({ video: qp });
                const newTrack = s.getVideoTracks()[0];
                cameraTrackRef.current = newTrack;
                // Update localStream
                const old = window.localStream?.getVideoTracks()[0];
                if (old) { window.localStream.removeTrack(old); old.stop(); }
                window.localStream.addTrack(newTrack);
                if (localVideoref.current) localVideoref.current.srcObject = window.localStream;
                replaceTrackOnAllPeers('video', newTrack);
            } catch(e) { setVideo(false); }
        } else {
            // Turn camera OFF: send black frames so remote peer doesn't freeze
            const blackTrack = createBlackVideoTrack();
            const old = window.localStream?.getVideoTracks()[0];
            if (old) { window.localStream.removeTrack(old); old.stop(); }
            window.localStream.addTrack(blackTrack);
            if (localVideoref.current) localVideoref.current.srcObject = window.localStream;
            replaceTrackOnAllPeers('video', blackTrack);
        }
    };

    // ── TOGGLE MIC: just toggle track.enabled — no stream replacement ─────
    // FIX #4 & #8: Audio mute never calls getUserMedia — won't break screen share
    const handleAudio = () => {
        const next = !audio;
        setAudio(next);
        if (window.localStream) {
            window.localStream.getAudioTracks().forEach(t => { t.enabled = next; });
        }
    };

    // ── SCREEN SHARE: replaceTrack — keeps peer connections intact ────────
    // FIX #2 & #8: Screen share uses replaceTrack instead of replacing entire stream
    const handleScreen = async () => {
        if (screen) {
            // Stop screen share
            const screenTrack = window.localStream?.getVideoTracks()[0];
            if (screenTrack) { screenTrack.stop(); screenTrack.onended = null; }
            setScreen(false);
            await restoreCameraTrack();
        } else {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:true });
                const screenVideoTrack = screenStream.getVideoTracks()[0];
                // Replace video track only — audio stays the same
                const old = window.localStream?.getVideoTracks()[0];
                if (old) window.localStream.removeTrack(old);
                window.localStream.addTrack(screenVideoTrack);
                if (localVideoref.current) localVideoref.current.srcObject = window.localStream;
                replaceTrackOnAllPeers('video', screenVideoTrack);
                setScreen(true);
                // Browser's native stop button
                screenVideoTrack.onended = async () => {
                    setScreen(false);
                    await restoreCameraTrack();
                };
            } catch(e) { setScreen(false); }
        }
    };

    // FIX #9: Restore camera track after screen share ends
    const restoreCameraTrack = async () => {
        try {
            const qp = QUALITY_PRESETS[videoQuality] || QUALITY_PRESETS['720p'];
            const s = await navigator.mediaDevices.getUserMedia({ video: video ? qp : false });
            if (s.getVideoTracks().length > 0) {
                const camTrack = s.getVideoTracks()[0];
                cameraTrackRef.current = camTrack;
                const old = window.localStream?.getVideoTracks()[0];
                if (old) window.localStream.removeTrack(old);
                window.localStream.addTrack(camTrack);
                if (localVideoref.current) localVideoref.current.srcObject = window.localStream;
                replaceTrackOnAllPeers('video', camTrack);
            } else {
                // Camera was off — send black frames
                const blk = createBlackVideoTrack();
                const old = window.localStream?.getVideoTracks()[0];
                if (old) window.localStream.removeTrack(old);
                window.localStream.addTrack(blk);
                if (localVideoref.current) localVideoref.current.srcObject = window.localStream;
                replaceTrackOnAllPeers('video', blk);
            }
        } catch(e) {
            const blk = createBlackVideoTrack();
            const old = window.localStream?.getVideoTracks()[0];
            if (old) window.localStream.removeTrack(old);
            window.localStream.addTrack(blk);
            if (localVideoref.current) localVideoref.current.srcObject = window.localStream;
            replaceTrackOnAllPeers('video', blk);
        }
    };

    const toggleLobbyVideo = () => {
        if (window.localStream) { const n=!lobbyVideoOn; window.localStream.getVideoTracks().forEach(t=>{t.enabled=n;}); setLobbyVideoOn(n); }
    };
    const toggleLobbyAudio = () => {
        if (window.localStream) { const n=!lobbyAudioOn; window.localStream.getAudioTracks().forEach(t=>{t.enabled=n;}); setLobbyAudioOn(n); }
    };

    // FIX #8: Device switching uses replaceTrack
    const switchDevice = async (deviceId, kind) => {
        try {
            const constraint = kind==='video' ? { video:{ deviceId:{ exact:deviceId } } } : { audio:{ deviceId:{ exact:deviceId } } };
            const ns = await navigator.mediaDevices.getUserMedia(constraint);
            const newTrack = kind==='video' ? ns.getVideoTracks()[0] : ns.getAudioTracks()[0];
            if (!newTrack) return;
            newTrack.enabled = kind==='video' ? lobbyVideoOn : lobbyAudioOn;
            const old = kind==='video' ? window.localStream?.getVideoTracks() : window.localStream?.getAudioTracks();
            old?.forEach(t => { window.localStream.removeTrack(t); t.stop(); });
            window.localStream.addTrack(newTrack);
            if (kind==='video' && localVideoref.current) localVideoref.current.srcObject = window.localStream;
            if (kind==='video') cameraTrackRef.current = newTrack;
            // If already in call, replace track on peers too
            replaceTrackOnAllPeers(kind, newTrack);
        } catch(e) { console.log('switchDevice error:', e); }
    };

    // ── RECORDING ─────────────────────────────────────────────────────────
    const startRecording = () => {
        if (!isHost) return;
        try {
            const W=1280,H=720, canvas=document.createElement('canvas');
            canvas.width=W; canvas.height=H;
            const ctx=canvas.getContext('2d');
            const drawFrame = () => {
                const feeds=[];
                if (localVideoref.current && localVideoref.current.readyState>=2) feeds.push({el:localVideoref.current, label:`${usernameRef.current}${screenRef.current?' 🖥️':''} (You)`});
                Object.entries(remoteVideoElsRef.current).forEach(([sid,el]) => { if(el&&el.readyState>=2) feeds.push({el, label:participantNames[sid]||'Participant'}); });
                ctx.fillStyle='#010430'; ctx.fillRect(0,0,W,H);
                if (feeds.length) {
                    const cols=feeds.length===1?1:feeds.length<=4?2:3, rows=Math.ceil(feeds.length/cols);
                    const gap=6, tW=Math.floor((W-gap*(cols+1))/cols), tH=Math.floor((H-gap*(rows+1))/rows);
                    feeds.forEach((f,i) => {
                        const col=i%cols, row=Math.floor(i/cols), x=gap+col*(tW+gap), y=gap+row*(tH+gap);
                        ctx.fillStyle='#0a0c28'; ctx.beginPath(); ctx.roundRect(x,y,tW,tH,8); ctx.fill();
                        ctx.save(); ctx.beginPath(); ctx.roundRect(x,y,tW,tH,8); ctx.clip();
                        try{ctx.drawImage(f.el,x,y,tW,tH);}catch(e){}
                        ctx.restore();
                        ctx.font='bold 13px Arial'; const tw=Math.min(ctx.measureText(f.label).width+20,tW-16);
                        ctx.fillStyle='rgba(0,0,0,0.62)'; ctx.beginPath(); ctx.roundRect(x+8,y+tH-30,tw,22,5); ctx.fill();
                        ctx.fillStyle='#fff'; ctx.fillText(f.label,x+16,y+tH-13,tW-24);
                    });
                }
                ctx.fillStyle='rgba(239,68,68,0.9)'; ctx.beginPath(); ctx.arc(W-28,20,7,0,Math.PI*2); ctx.fill();
                ctx.fillStyle='#fff'; ctx.font='bold 12px Arial'; ctx.fillText('REC',W-18,25);
                recordingRAFRef.current = requestAnimationFrame(drawFrame);
            };
            drawFrame();
            const aC=new (window.AudioContext||window.webkitAudioContext)(), dst=aC.createMediaStreamDestination();
            if(window.localStream) try{aC.createMediaStreamSource(window.localStream).connect(dst);}catch(e){}
            Object.values(remoteVideoElsRef.current).forEach(el=>{if(el&&el.srcObject) try{aC.createMediaStreamSource(el.srcObject).connect(dst);}catch(e){}});
            const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')?'video/webm;codecs=vp8,opus':'video/webm';
            const rec=new MediaRecorder(new MediaStream([...canvas.captureStream(24).getVideoTracks(),...dst.stream.getAudioTracks()]),{mimeType:mime});
            recordedChunksRef.current=[];
            rec.ondataavailable=e=>{if(e.data.size>0) recordedChunksRef.current.push(e.data);};
            rec.onstop=()=>{
                if(recordingRAFRef.current){cancelAnimationFrame(recordingRAFRef.current);recordingRAFRef.current=null;}
                const blob=new Blob(recordedChunksRef.current,{type:'video/webm'}), url=URL.createObjectURL(blob), a=document.createElement('a');
                a.href=url; a.download=`DConnect-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.webm`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                try{aC.close();}catch(e){}
            };
            mediaRecorderRef.current=rec; rec.start(1000); setIsRecording(true);
            socketRef.current?.emit('chat-message','__RECORDING_START__',username);
            addToast('Recording whole meeting ⏺','join');
        } catch(e){ addToast('Recording not supported','leave'); }
    };

    const stopRecording = () => {
        if(recordingRAFRef.current){cancelAnimationFrame(recordingRAFRef.current);recordingRAFRef.current=null;}
        if(mediaRecorderRef.current&&mediaRecorderRef.current.state!=='inactive') mediaRecorderRef.current.stop();
        setIsRecording(false);
        socketRef.current?.emit('chat-message','__RECORDING_STOP__',username);
        addToast('Recording saved ✓','hand');
    };

    const handleRecording = () => { if(!isHost) return; if(isRecording) stopRecording(); else startRecording(); };
    const handlePin = sid => setPinnedId(p=>p===sid?null:sid);

    // ── NOISE CANCELLATION ────────────────────────────────────────────────
    const toggleNoiseCancellation = async () => {
        if (noiseCancellation) {
            if(originalAudioRef.current && window.localStream){
                const proc=window.localStream.getAudioTracks()[0];
                if(proc) window.localStream.removeTrack(proc);
                window.localStream.addTrack(originalAudioRef.current);
                replaceTrackOnAllPeers('audio', originalAudioRef.current);
            }
            if(noiseAudioCtxRef.current){try{noiseAudioCtxRef.current.close();}catch(e){} noiseAudioCtxRef.current=null;}
            originalAudioRef.current=null; setNoiseCancellation(false); addToast('Noise cancellation off','leave');
        } else {
            const orig=window.localStream?.getAudioTracks()[0];
            if(!orig){addToast('No microphone available','leave');return;}
            try{
                originalAudioRef.current=orig;
                const aC=new(window.AudioContext||window.webkitAudioContext)(); noiseAudioCtxRef.current=aC;
                const src=aC.createMediaStreamSource(new MediaStream([orig]));
                const hp=aC.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=80;
                const lp=aC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=8000;
                const comp=aC.createDynamicsCompressor(); comp.threshold.value=-40; comp.knee.value=10; comp.ratio.value=8; comp.attack.value=0.003; comp.release.value=0.1;
                const dst=aC.createMediaStreamDestination();
                src.connect(hp); hp.connect(lp); lp.connect(comp); comp.connect(dst);
                const proc=dst.stream.getAudioTracks()[0];
                window.localStream.removeTrack(orig); window.localStream.addTrack(proc);
                replaceTrackOnAllPeers('audio', proc);
                setNoiseCancellation(true); addToast('Noise cancellation on 🎙️','join');
            } catch(e){addToast('Noise cancellation not supported','leave');}
        }
    };

    // ── CO-HOSTS ──────────────────────────────────────────────────────────
    const makeCoHost  = id => socketRef.current.emit('cohost-action',{type:'add',    targetId:id, path:path()});
    const removeCoHost= id => socketRef.current.emit('cohost-action',{type:'remove', targetId:id, path:path()});

    // ── WAITING ROOM ──────────────────────────────────────────────────────
    const toggleWaitingRoom = () => {
        const next=!waitingRoomEnabled; setWaitingRoomEnabled(next);
        socketRef.current.emit('set-waiting-room',window.location.href,next);
        addToast(next?'⏳ Waiting room enabled':'Waiting room disabled', next?'hand':'join');
    };
    const admitUser = sid => { socketRef.current.emit('admit-user',sid,window.location.href); setWaitingParticipants(p=>p.filter(w=>w.socketId!==sid)); addToast(`Admitted ${participantNames[sid]||'participant'}`,'join'); };
    const denyUser  = sid => { socketRef.current.emit('deny-user',sid,window.location.href); setWaitingParticipants(p=>p.filter(w=>w.socketId!==sid)); };

    // ── PRIVATE MESSAGES ──────────────────────────────────────────────────
    const sendMessage = () => {
        if (!message.trim()) return;
        if (privateTarget==='all') { socketRef.current.emit('chat-message',message,username); }
        else { socketRef.current.emit('private-message',privateTarget,message,username); }
        setMessage('');
    };

    // ── POLLS ─────────────────────────────────────────────────────────────
    const createPoll = () => {
        const opts=pollOptions.filter(o=>o.trim());
        if(!pollQuestion.trim()||opts.length<2) return;
        const poll={question:pollQuestion.trim(),options:opts};
        socketRef.current.emit('chat-message',`__POLL__:${JSON.stringify(poll)}`,username);
        setActivePoll(poll); setPollVotes({}); setMyVote(null);
        setShowPollModal(false); setPollQuestion(''); setPollOptions(['','']);
    };
    const votePoll = idx => {
        if(myVote!==null) return; setMyVote(idx);
        socketRef.current.emit('chat-message',`__POLL_VOTE__:${idx}`,username);
    };

    // ── HOST ACTIONS ──────────────────────────────────────────────────────
    // #17 FIX: dedicated socket events for moderation — no longer piggybacking chat-message
    const path = () => window.location.href;
    const hostMuteMic    = id => socketRef.current.emit('host-action',{type:'mute-mic',   targetId:id, path:path()});
    const hostUnmuteReq  = id => socketRef.current.emit('host-action',{type:'unmute-req', targetId:id, path:path()});
    const hostMuteCam    = id => socketRef.current.emit('host-action',{type:'mute-cam',   targetId:id, path:path()});
    const hostKick       = id => { socketRef.current.emit('host-action',{type:'kick', targetId:id, path:path()}); setConfirmKick(null); };
    const hostMuteAll    = () => { socketRef.current.emit('host-action',{type:'mute-all', path:path()}); const u={}; videos.forEach(v=>{u[v.socketId]={...remoteStates[v.socketId],micMuted:true};}); setRemoteStates(p=>({...p,...u})); addToast('All participants muted','hand'); };
    const hostLockMeeting= () => { const next=!meetingLocked; setMeetingLocked(next); socketRef.current.emit('lock-room',window.location.href,next); addToast(next?'🔒 Meeting locked':'🔓 Meeting unlocked',next?'leave':'join'); };
    const hostTransfer   = id => { socketRef.current.emit('host-action',{type:'transfer-host', targetId:id, path:path()}); };

    // ── CAPTIONS ──────────────────────────────────────────────────────────
    const showCapBubble = (name,text) => {
        setActiveCaption({name,text});
        if(captionClearRef.current) clearTimeout(captionClearRef.current);
        captionClearRef.current=setTimeout(()=>setActiveCaption(null),4000);
    };
    const toggleCaptions = () => {
        const API=window.SpeechRecognition||window.webkitSpeechRecognition;
        if(!API){addToast('Captions not supported','leave');return;}
        if(captionsOn){ captionsOnRef.current=false; if(recognitionRef.current){try{recognitionRef.current.onend=null;recognitionRef.current.stop();}catch(e){} recognitionRef.current=null;} setCaptionsOn(false); setActiveCaption(null); return; }
        try {
            const r=new API(); r.continuous=true; r.interimResults=true; r.lang='en-US';
            r.onresult=ev=>{
                if(!audioRef.current) return;
                let fi='',ii='';
                for(let i=ev.resultIndex;i<ev.results.length;i++){const t=ev.results[i][0].transcript; if(ev.results[i].isFinal) fi+=t; else ii+=t;}
                if(fi.trim()){showCapBubble(username,fi.trim()); socketRef.current?.emit('chat-message',`__CAPTION__:${fi.trim()}`,username);}
                else if(ii.trim()) showCapBubble(username,ii.trim());
            };
            r.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){addToast('Mic access needed','leave'); captionsOnRef.current=false; setCaptionsOn(false);}};
            r.onend=()=>{ if(captionsOnRef.current) try{r.start();}catch(e){} };
            recognitionRef.current=r; captionsOnRef.current=true; r.start(); setCaptionsOn(true); addToast('Captions on 💬','join');
        } catch(e){addToast('Could not start captions','leave');}
    };

    // ── UI HELPERS ─────────────────────────────────────────────────────────
    const toggleFullscreen = () => { if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{}); else document.exitFullscreen(); };
    const toggleMirror = () => setMirrorVideo(p=>!p);
    const toggleTheme  = () => setTheme(p=>p==='dark'?'light':'dark');
    const handleChatScroll = e => { const {scrollTop,scrollHeight,clientHeight}=e.target; setShowScrollBtn(scrollHeight-scrollTop-clientHeight>80); };
    const scrollToBottom = () => { if(chatBottomRef.current) chatBottomRef.current.scrollIntoView({behavior:'smooth'}); setShowScrollBtn(false); };
    const insertEmoji = e => { setMessage(p=>p+e); setShowEmojiPicker(false); };

    const openSidePanel  = panel => { if(panel==='chat'){setShowChat(true);setShowParticipants(false);setNewMessages(0);}else{setShowParticipants(true);setShowChat(false);} };
    const closeSidePanel = () => { setShowChat(false); setShowParticipants(false); };
    const isSidePanelOpen = showChat||showParticipants;
    const getName = sid => participantNames[sid]||'Participant';
    const formatTime = s => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; };
    const getRoomName = () => { const p=window.location.pathname.split('/'); return p[p.length-1]||'Meeting'; };
    const handleInvite = () => { navigator.clipboard.writeText(getRoomName()); setInviteCopied(true); setTimeout(()=>setInviteCopied(false),2500); };

    const pinnedVideo = videos.find(v=>v.socketId===pinnedId);
    const otherVideos = videos.filter(v=>v.socketId!==pinnedId);
    const getGridStyle = count => {
        if(!count) return {};
        const cols=count===1?1:count<=4?2:count<=9?3:4, rows=Math.ceil(count/cols);
        return {gridTemplateColumns:`repeat(${cols},1fr)`,gridTemplateRows:`repeat(${rows},1fr)`};
    };

    // ── FIX #6: ICE CANDIDATE QUEUING + FIX #7: use ontrack ─────────────
    const gotMessageFromServer = (fromId, msg) => {
        const signal = JSON.parse(msg);
        if (fromId === socketIdRef.current) return;

        if (signal.sdp) {
            connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp))
            .then(() => {
                if (signal.sdp.type === 'offer') {
                    return connections[fromId].createAnswer()
                    .then(d => connections[fromId].setLocalDescription(d))
                    .then(() => socketRef.current.emit('signal', fromId, JSON.stringify({ sdp: connections[fromId].localDescription })));
                }
            })
            .then(() => {
                // Flush queued ICE candidates
                const queue = iceCandidateQueues.current[fromId] || [];
                iceCandidateQueues.current[fromId] = [];
                queue.forEach(ice => {
                    connections[fromId].addIceCandidate(new RTCIceCandidate(ice))
                    .catch(e => console.log('ICE flush error:', e));
                });
            })
            .catch(e => console.log('SDP error:', e));
        }

        if (signal.ice) {
            if (connections[fromId]?.remoteDescription) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice))
                .catch(e => console.log('ICE error:', e));
            } else {
                // Queue until remote description is ready
                if (!iceCandidateQueues.current[fromId]) iceCandidateQueues.current[fromId] = [];
                iceCandidateQueues.current[fromId].push(signal.ice);
            }
        }
    };

    // ── CONNECT TO SOCKET ─────────────────────────────────────────────────
    const connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false });
        socketRef.current.on('signal', gotMessageFromServer);
        socketRef.current.on('disconnect', () => setIsConnected(false));

        socketRef.current.on('force-kicked', () => { addToast('You have been removed from the meeting','leave'); playSound('leave'); setTimeout(()=>handleEndCall(),1500); });
        socketRef.current.on('room-locked',     () => { addToast('This meeting is locked 🔒','leave'); playSound('alert'); setTimeout(()=>window.location.href='/',2000); });
        socketRef.current.on('room-lock-status',locked=>{ setMeetingLocked(locked); if(!isHostRef.current) addToast(locked?'🔒 Meeting locked by host':'🔓 Meeting unlocked',locked?'leave':'join'); });

        // #17 FIX: receive dedicated moderation commands (not via chat)
        socketRef.current.on('host-command', ({type}) => {
            switch(type) {
                case 'mute-mic':
                    setAudio(false);
                    if(window.localStream) window.localStream.getAudioTracks().forEach(t=>{t.enabled=false;});
                    addToast('Host muted your microphone 🔇','leave'); playSound('alert'); break;
                case 'mute-cam':
                    setVideo(false);
                    addToast('Host turned off your camera 📷','leave'); playSound('alert'); break;
                case 'unmute-req':
                    addToast('Host is asking you to unmute 🎙️','hand'); playSound('alert'); break;
                default: break;
            }
        });

        // #17 FIX: host changed via dedicated event
        socketRef.current.on('host-changed', ({newHostId, fromId}) => {
            setHostSocketId(newHostId);
            if(newHostId===socketIdRef.current){ setIsHost(true); isHostRef.current=true; addToast('You are now the host 👑','hand'); playSound('alert'); }
            else if(fromId===socketIdRef.current){ setIsHost(false); isHostRef.current=false; addToast('Host role transferred','hand'); }
        });

        // #17 FIX: co-host changes via dedicated event
        socketRef.current.on('cohost-changed', ({action, targetId}) => {
            if(action==='add'){
                setCoHosts(p=>p.includes(targetId)?p:[...p,targetId]);
                if(targetId===socketIdRef.current){ addToast('You are now a co-host 🌟','hand'); playSound('alert'); }
                else { setParticipantNames(prev=>prev); addToast(`${participantNames[targetId]||'A participant'} is now co-host 🌟`,'hand'); }
            } else {
                setCoHosts(p=>p.filter(id=>id!==targetId));
                if(targetId===socketIdRef.current) addToast('Your co-host role was removed','leave');
            }
        });
        socketRef.current.on('waiting-room-queued',   ()=>{ setWaitingForAdmission(true); addToast('Waiting for host to admit you...','hand'); });
        socketRef.current.on('waiting-room-status',   en=>setWaitingRoomEnabled(en));
        socketRef.current.on('user-waiting',          entry=>{ setParticipantNames(p=>({...p,[entry.socketId]:entry.name})); setWaitingParticipants(p=>[...p,entry]); playSound('alert'); addToast(`${entry.name} is waiting ⏳`,'hand'); });
        socketRef.current.on('waiting-user-left',     sid=>setWaitingParticipants(p=>p.filter(w=>w.socketId!==sid)));
        socketRef.current.on('waiting-room-denied',   ()=>{ addToast('You were not admitted','leave'); playSound('leave'); setTimeout(()=>window.location.href='/',2000); });
        socketRef.current.on('private-message',       (data,sender,fromId)=>{ const ts=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); const own=fromId===socketIdRef.current; const entry={sender:own?username:sender,data,timestamp:ts,isPrivate:true,fromId}; setMessages(p=>[...p,entry]); if(!own){setNewMessages(p=>p+1); addToast(`💬 Private from ${sender}`,'hand');} });

        socketRef.current.on('connect', () => {
            setIsConnected(true);
            socketRef.current.emit('join-call', window.location.href, usernameRef.current);
            socketIdRef.current = socketRef.current.id;
            socketRef.current.on('chat-message', addMessage);

            socketRef.current.on('user-left', id => {
                playSound('leave'); addToast('A participant left','leave');
                setPinnedId(p=>p===id?null:p);
                setCoHosts(p=>p.filter(c=>c!==id));
                setParticipantNames(p=>{const n={...p};delete n[id];return n;});
                setRemoteStates(p=>{const n={...p};delete n[id];return n;});
                delete remoteVideoElsRef.current[id];
                delete iceCandidateQueues.current[id];
                if (connections[id]) { try{connections[id].close();}catch(e){} delete connections[id]; }
                setVideos(vs=>vs.filter(v=>v.socketId!==id));
            });

            socketRef.current.on('user-joined', (id, clients) => {
                if (id===socketIdRef.current) setWaitingForAdmission(false);

                if (id===socketIdRef.current && clients.length===1) {
                    setIsHost(true); isHostRef.current=true; setHostSocketId(socketIdRef.current);
                    setTimeout(()=>socketRef.current?.emit('chat-message',`__HOST_CLAIM__:${socketIdRef.current}`,username),400);
                }
                if (id!==socketIdRef.current) {
                    playSound('join'); addToast('A participant joined','join');
                    setTimeout(()=>{
                        socketRef.current?.emit('chat-message',`__USERNAME__:${username}`,username);
                        if(isHostRef.current) { socketRef.current?.emit('chat-message',`__HOST_CLAIM__:${socketIdRef.current}`,username); coHosts.forEach(c=>socketRef.current?.emit('chat-message',`__COHOST_ADD__:${c}`,username)); }
                    },400);
                } else {
                    setTimeout(()=>socketRef.current?.emit('chat-message',`__USERNAME__:${username}`,username),300);
                }

                // FIX #1 & #7: use addTrack + ontrack instead of deprecated addStream/onaddstream
                clients.forEach(sid => {
                    if (connections[sid]) return; // already set up

                    connections[sid] = new RTCPeerConnection(peerConfig);
                    iceCandidateQueues.current[sid] = [];

                    connections[sid].onicecandidate = ev => {
                        if (ev.candidate) socketRef.current.emit('signal', sid, JSON.stringify({ ice: ev.candidate }));
                    };

                    // FIX #7: ontrack fires for each individual track — reliable in all browsers
                    connections[sid].ontrack = ev => {
                        const stream = ev.streams?.[0];
                        if (!stream) return;
                        const exists = videoRef.current.find(v => v.socketId === sid);
                        if (exists) {
                            setVideos(vs => { const u=vs.map(v=>v.socketId===sid?{...v,stream}:v); videoRef.current=u; return u; });
                        } else {
                            const nv = { socketId:sid, stream };
                            setVideos(vs => { const u=[...vs,nv]; videoRef.current=u; return u; });
                        }
                    };

                    // FIX #1 & #7: addTrack for each track in localStream
                    if (window.localStream) {
                        window.localStream.getTracks().forEach(track => {
                            connections[sid].addTrack(track, window.localStream);
                        });
                    } else {
                        // Send silence + black if no local stream yet
                        const blk = createBlackVideoTrack();
                        const sil = createSilenceTrack();
                        const dummy = new MediaStream([blk, sil]);
                        window.localStream = dummy;
                        dummy.getTracks().forEach(t => connections[sid].addTrack(t, dummy));
                    }
                });

                // If I just joined, create offers to all existing participants
                if (id === socketIdRef.current) {
                    for (const id2 in connections) {
                        if (id2 === socketIdRef.current) continue;
                        connections[id2].createOffer()
                        .then(d => connections[id2].setLocalDescription(d))
                        .then(() => socketRef.current.emit('signal', id2, JSON.stringify({ sdp: connections[id2].localDescription })))
                        .catch(e => console.log('offer error:', e));
                    }
                }
            });
        });
    };

    const getMedia = () => {
        setVideo(lobbyVideoOn && videoAvailable);
        setAudio(lobbyAudioOn && audioAvailable);
        // Apply initial audio state to tracks
        if (window.localStream) {
            window.localStream.getAudioTracks().forEach(t => { t.enabled = lobbyAudioOn && audioAvailable; });
            window.localStream.getVideoTracks().forEach(t => { t.enabled = lobbyVideoOn && videoAvailable; });
        }
        connectToSocketServer();
        timerRef.current = setInterval(() => setCallDuration(p=>p+1), 1000);
    };

    const handleEndCall = () => {
        if(timerRef.current) clearInterval(timerRef.current);
        if(isRecording) stopRecording();
        if(recordingRAFRef.current){cancelAnimationFrame(recordingRAFRef.current);recordingRAFRef.current=null;}
        if(noiseCancellation && noiseAudioCtxRef.current){try{noiseAudioCtxRef.current.close();}catch(e){}}
        if(captionsOnRef.current && recognitionRef.current){try{recognitionRef.current.onend=null;recognitionRef.current.stop();}catch(e){}}
        Object.values(analysersRef.current).forEach(({audioCtx})=>{try{audioCtx.close();}catch(e){}});
        try { if(socketRef.current){socketRef.current.removeAllListeners();socketRef.current.disconnect();} } catch(e){}
        try { Object.values(connections).forEach(pc=>{try{pc.close();}catch(e){}});  } catch(e){}
        try { window.localStream?.getTracks().forEach(t=>t.stop()); } catch(e){}
        window.location.href = '/';
    };

    const addMessage = (data, sender, socketIdSender) => {
        if (socketIdSender && sender && !data.startsWith('__')) setParticipantNames(p=>({...p,[socketIdSender]:sender}));

        if (data.startsWith('__USERNAME__:'))     { setParticipantNames(p=>({...p,[socketIdSender]:sender})); return; }
        if (data.startsWith('__HOST_CLAIM__:'))    { const id=data.replace('__HOST_CLAIM__:',''); setHostSocketId(id); if(id===socketIdRef.current){setIsHost(true);isHostRef.current=true;} return; }
        if (data.startsWith('__HOST_TRANSFER__:')) { const n=data.replace('__HOST_TRANSFER__:',''); setHostSocketId(n); if(n===socketIdRef.current){setIsHost(true);isHostRef.current=true;addToast('You are now the host 👑','hand');playSound('alert');}else if(socketIdSender===socketIdRef.current){setIsHost(false);isHostRef.current=false;} return; }
        // Moderation commands (#17) now handled via dedicated socket events (host-command, host-changed, cohost-changed)
        // __HOST_MUTE_MIC__, __HOST_MUTE_ALL__, __HOST_UNMUTE_REQ__, __HOST_MUTE_CAM__, __HOST_KICK__, __HOST_TRANSFER__, __COHOST_*
        // are no longer sent via chat-message — drop any legacy versions silently
        if (data.startsWith('__HOST_MUTE_MIC__:') || data==='__HOST_MUTE_ALL__' || data.startsWith('__HOST_UNMUTE_REQ__:') || data.startsWith('__HOST_MUTE_CAM__:') || data.startsWith('__HOST_KICK__:') || data.startsWith('__HOST_TRANSFER__:') || data.startsWith('__COHOST_')) { return; }
        if (data.startsWith('__HAND__:'))          { if(socketIdSender!==socketIdRef.current){const r=data.split(':')[1]==='true'; setRaisedHands(p=>({...p,[socketIdSender]:r})); if(r)addToast(`${sender} raised their hand ✋`,'hand');} return; }
        if (data.startsWith('__REACTION__:'))       { if(socketIdSender!==socketIdRef.current){const e=data.split(':')[1]; const id=Date.now()+Math.random(),x=20+Math.random()*60; setActiveReactions(p=>[...p,{id,emoji:e,x}]); setTimeout(()=>setActiveReactions(p=>p.filter(r=>r.id!==id)),3200);} return; }
        if (data.startsWith('__CAPTION__:'))        { if(socketIdSender!==socketIdRef.current) showCapBubble(sender,data.replace('__CAPTION__:','')); return; }
        if (data==='__RECORDING_START__')           { if(socketIdSender!==socketIdRef.current){setIsRemoteRecording(true);addToast(`${sender} is recording ⏺`,'hand');} return; }
        if (data==='__RECORDING_STOP__')            { setIsRemoteRecording(false); return; }
        if (data.startsWith('__COHOST_ADD__:'))     { const t=data.replace('__COHOST_ADD__:',''); setCoHosts(p=>p.includes(t)?p:[...p,t]); if(t===socketIdRef.current){addToast('You are now a co-host 🌟','hand');playSound('alert');} else addToast(`${getName(t)||sender} is now co-host 🌟`,'hand'); return; }
        if (data.startsWith('__COHOST_REMOVE__:'))  { const t=data.replace('__COHOST_REMOVE__:',''); setCoHosts(p=>p.filter(id=>id!==t)); if(t===socketIdRef.current) addToast('Your co-host role was removed','leave'); return; }
        if (data.startsWith('__POLL__:'))           { try{const p=JSON.parse(data.replace('__POLL__:','')); setActivePoll(p); setPollVotes({}); setMyVote(null); addToast('📊 New poll started!','hand');}catch(e){} return; }
        if (data.startsWith('__POLL_VOTE__:'))      { const i=parseInt(data.replace('__POLL_VOTE__:','')); if(!isNaN(i)) setPollVotes(p=>({...p,[socketIdSender]:i})); return; }

        setParticipantNames(p=>({...p,[socketIdSender]:sender}));
        setMessages(p=>[...p,{sender,data,timestamp:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),isPrivate:false}]);
        if(socketIdSender!==socketIdRef.current) setNewMessages(p=>p+1);
    };

    const triggerReaction = emoji => {
        if(socketRef.current) socketRef.current.emit('chat-message',`__REACTION__:${emoji}`,username);
        const id=Date.now()+Math.random(),x=20+Math.random()*60;
        setActiveReactions(p=>[...p,{id,emoji,x}]); setTimeout(()=>setActiveReactions(p=>p.filter(r=>r.id!==id)),3200);
        setShowReactions(false);
    };
    const handleRaiseHand = () => { const n=!handRaised; setHandRaised(n); socketRef.current?.emit('chat-message',`__HAND__:${n}`,username); if(n) addToast('You raised your hand ✋','hand'); };

    const connect = () => { setAskForUsername(false); getMedia(); };

    const darkFieldSx  = {flex:1,'& .MuiOutlinedInput-root':{color:'#fff',borderRadius:'12px','& fieldset':{borderColor:'rgba(255,255,255,0.15)'},'&:hover fieldset':{borderColor:'rgba(255,255,255,0.3)'},'&.Mui-focused fieldset':{borderColor:'#3b82f6'}},'& .MuiInputLabel-root':{color:'rgba(255,255,255,0.4)'},'& .MuiInputLabel-root.Mui-focused':{color:'#3b82f6'}};
    const lobbyFieldSx = {width:'100%','& .MuiOutlinedInput-root':{color:'#fff',borderRadius:'10px','& fieldset':{borderColor:'rgba(255,255,255,0.2)'},'&:hover fieldset':{borderColor:'rgba(255,255,255,0.4)'},'&.Mui-focused fieldset':{borderColor:'#3b82f6'}},'& .MuiInputLabel-root':{color:'rgba(255,255,255,0.5)'},'& .MuiInputLabel-root.Mui-focused':{color:'#3b82f6'}};

    return (
        <div>
        {askForUsername ? (
        <div className={styles.lobbyContainer}>
            <div className={styles.lobbyCard}>
                <div className={styles.lobbyBrand}><h1>DConnect</h1><p>HD video calls, right in your browser</p></div>
                <div className={styles.lobbyPreview}>
                    <video ref={localVideoref} autoPlay muted></video>
                    {!lobbyVideoOn&&<div className={styles.lobbyVideoOffOverlay}><VideocamOffIcon sx={{fontSize:'2.8rem',color:'rgba(255,255,255,0.35)'}}/><p>Camera is off</p></div>}
                </div>
                <div className={styles.lobbyDeviceRow}>
                    <button onClick={toggleLobbyVideo} className={`${styles.lobbyDeviceBtn} ${!lobbyVideoOn?styles.lobbyDeviceBtnOff:''}`}>{lobbyVideoOn?<VideocamIcon sx={{fontSize:'1.15rem'}}/>:<VideocamOffIcon sx={{fontSize:'1.15rem'}}/>}<span>{lobbyVideoOn?'Camera On':'Camera Off'}</span></button>
                    <button onClick={toggleLobbyAudio} className={`${styles.lobbyDeviceBtn} ${!lobbyAudioOn?styles.lobbyDeviceBtnOff:''}`}>{lobbyAudioOn?<MicIcon sx={{fontSize:'1.15rem'}}/>:<MicOffIcon sx={{fontSize:'1.15rem'}}/>}<span>{lobbyAudioOn?'Mic On':'Mic Off'}</span></button>
                </div>
                {(cameras.length>1||mics.length>1)&&(
                <div className={styles.deviceSelectors}>
                    {cameras.length>1&&<div className={styles.deviceSelectGroup}><label className={styles.deviceSelectLabel}>🎥 Camera</label><div className={styles.deviceSelectWrapper}><select className={styles.deviceSelect} value={selectedCamera} onChange={e=>{setSelectedCamera(e.target.value);switchDevice(e.target.value,'video');}}>{cameras.map((c,i)=><option key={c.deviceId} value={c.deviceId}>{c.label||`Camera ${i+1}`}</option>)}</select></div></div>}
                    {mics.length>1&&<div className={styles.deviceSelectGroup}><label className={styles.deviceSelectLabel}>🎙️ Microphone</label><div className={styles.deviceSelectWrapper}><select className={styles.deviceSelect} value={selectedMic} onChange={e=>{setSelectedMic(e.target.value);switchDevice(e.target.value,'audio');}}>{mics.map((m,i)=><option key={m.deviceId} value={m.deviceId}>{m.label||`Mic ${i+1}`}</option>)}</select></div></div>}
                </div>)}
                <div className={styles.deviceSelectGroup}>
                    <label className={styles.deviceSelectLabel}>📹 Video Quality</label>
                    <div className={styles.deviceSelectWrapper}><select className={styles.deviceSelect} value={videoQuality} onChange={e=>setVideoQuality(e.target.value)}><option value="360p">360p — Low (saves bandwidth)</option><option value="720p">720p — Medium (recommended)</option><option value="1080p">1080p — High (fast connection)</option></select></div>
                </div>
                <div className={styles.lobbyForm}>
                    <TextField label="Your display name" value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==='Enter'&&username.trim()&&connect()} variant="outlined" sx={lobbyFieldSx}/>
                    <Button variant="contained" onClick={connect} disabled={!username.trim()} fullWidth sx={{mt:1.5,py:1.5,background:'#3b82f6','&:hover':{background:'#2563eb'},'&.Mui-disabled':{background:'rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.25)'},borderRadius:'10px',fontSize:'1rem',fontWeight:600,textTransform:'none',boxShadow:'none'}}>
                        Join Now{(!lobbyVideoOn||!lobbyAudioOn)&&<span className={styles.joinHint}>{!lobbyVideoOn&&!lobbyAudioOn?' · No cam, no mic':!lobbyVideoOn?' · No camera':' · Muted'}</span>}
                    </Button>
                </div>
            </div>
        </div>
        ) : waitingForAdmission ? (
        <div className={styles.waitingScreen}>
            <div className={styles.waitingCard}>
                <HourglassEmptyIcon sx={{fontSize:'3.5rem',color:'#fbbf24',animation:'spin 2s linear infinite'}}/>
                <h2 className={styles.waitingTitle}>Waiting to be admitted</h2>
                <p className={styles.waitingSubtitle}>The host will let you in soon</p>
                <div className={styles.waitingUser}><span className={styles.waitingAvatar}>{username.charAt(0).toUpperCase()}</span><span className={styles.waitingName}>{username}</span></div>
                <div className={styles.waitingDots}><span></span><span></span><span></span></div>
                <button className={styles.waitingLeaveBtn} onClick={()=>window.location.href='/'}>Leave</button>
            </div>
        </div>
        ) : (
        <div className={`${styles.meetVideoContainer} ${theme==='light'?styles.lightTheme:''}`}>

            <div className={styles.navbar}>
                <div className={styles.navLeft}>
                    <span className={styles.navBrand}>DConnect {isHost&&<span className={styles.hostCrown}>👑</span>}{isCoHost&&!isHost&&<span className={styles.coHostStar}>🌟</span>}</span>
                    <span className={styles.navRoom}>Room: {getRoomName()}</span>
                    {meetingLocked&&<span className={styles.lockBadge}>🔒 Locked</span>}
                    {waitingRoomEnabled&&<span className={styles.waitingBadge}>⏳ Waiting Room</span>}
                </div>
                <div className={styles.navCenter}>
                    <span className={styles.navStatus}><span className={isConnected?styles.dotConnected:styles.dotConnecting}></span>{isConnected?'Connected':'Connecting...'}</span>
                    <span className={styles.navDivider}>|</span>
                    <span className={styles.navTimer}>{formatTime(callDuration)}</span>
                    {(isRecording||isRemoteRecording)&&<span className={styles.recNavBadge}>⏺ REC</span>}
                </div>
                <div className={styles.navRight}>
                    <span className={styles.navParticipants}>👥 {videos.length+1}{waitingParticipants.length>0&&<span className={styles.waitingCount}> +{waitingParticipants.length} waiting</span>}</span>
                    <button className={`${styles.navBtn} ${inviteCopied?styles.navBtnCopied:''}`} onClick={handleInvite}>{inviteCopied?`✓ Code: ${getRoomName()}`:'Invite'}</button>
                    <button className={styles.navBtn} onClick={()=>setShowQR(p=>!p)} title="QR Code"><QrCode2Icon sx={{fontSize:'1rem',verticalAlign:'middle'}}/></button>
                    {canModerate&&<button className={`${styles.navBtn} ${meetingLocked?styles.navBtnLocked:''}`} onClick={hostLockMeeting}>{meetingLocked?'🔓 Unlock':'🔒 Lock'}</button>}
                </div>
            </div>

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

            {activeCaption&&<div className={styles.captionBubble}><span className={styles.captionName}>{activeCaption.name}:</span> {activeCaption.text}</div>}

            {/* SIDE PANEL */}
            {isSidePanelOpen&&(
            <div className={styles.sidePanel}>
                <div className={styles.sidePanelTabs}>
                    <button className={`${styles.sidePanelTab} ${showParticipants?styles.sidePanelTabActive:''}`} onClick={()=>openSidePanel('participants')}>👥 People ({videos.length+1}){waitingParticipants.length>0&&<span className={styles.chatBadge}>{waitingParticipants.length}</span>}</button>
                    <button className={`${styles.sidePanelTab} ${showChat?styles.sidePanelTabActive:''}`} onClick={()=>openSidePanel('chat')}>💬 Chat {newMessages>0&&!showChat&&<span className={styles.chatBadge}>{newMessages}</span>}</button>
                    <button className={styles.sidePanelClose} onClick={closeSidePanel}>✕</button>
                </div>
                {showParticipants&&(
                <div className={styles.participantsContent}>
                    {canModerate&&waitingParticipants.length>0&&(
                    <div className={styles.waitingSection}>
                        <div className={styles.waitingSectionTitle}>⏳ Waiting ({waitingParticipants.length})</div>
                        {waitingParticipants.map(w=>(
                        <div key={w.socketId} className={styles.waitingParticipantItem}>
                            <span className={styles.participantAvatar}>{w.name.charAt(0).toUpperCase()}</span>
                            <span className={styles.waitingParticipantName}>{w.name}</span>
                            <div className={styles.waitingActions}>
                                <button className={styles.admitBtn} onClick={()=>admitUser(w.socketId)}>✓ Admit</button>
                                <button className={styles.denyBtn}  onClick={()=>denyUser(w.socketId)}>✕ Deny</button>
                            </div>
                        </div>))}
                    </div>)}
                    {canModerate&&<div className={styles.hostBulkRow}><button className={styles.hostBulkBtn} onClick={hostMuteAll}>🔇 Mute All</button></div>}
                    <div className={styles.participantItem}>
                        <div className={styles.participantInfo}>
                            <span className={styles.participantAvatar}>{username.charAt(0).toUpperCase()}</span>
                            <div><span className={styles.participantName}>{username}{isHost&&<span className={styles.hostTag}>👑 Host</span>}{isCoHost&&!isHost&&<span className={styles.coHostTag}>🌟 Co-host</span>}</span><span className={styles.participantYou}>(You)</span></div>
                        </div>
                        <div className={styles.participantStatus}>{audio?<MicIcon sx={{fontSize:'1rem',color:'#22c55e'}}/>:<MicOffIcon sx={{fontSize:'1rem',color:'#ef4444'}}/> }{video?<VideocamIcon sx={{fontSize:'1rem',color:'#22c55e'}}/>:<VideocamOffIcon sx={{fontSize:'1rem',color:'#ef4444'}}/>}</div>
                    </div>
                    {videos.map(v=>(
                    <div key={v.socketId}>
                        <div className={styles.participantItem}>
                            <div className={styles.participantInfo}>
                                <span className={styles.participantAvatar}>{getName(v.socketId).charAt(0).toUpperCase()}</span>
                                <div><span className={styles.participantName}>{getName(v.socketId)}{v.socketId===hostSocketId&&<span className={styles.hostTag}>👑</span>}{coHosts.includes(v.socketId)&&<span className={styles.coHostTag}>🌟</span>}</span>{raisedHands[v.socketId]&&<span className={styles.handIndicator}>✋ Hand raised</span>}</div>
                            </div>
                            <div className={styles.participantStatus}>{remoteStates[v.socketId]?.micMuted?<MicOffIcon sx={{fontSize:'1rem',color:'#ef4444'}}/>:<MicIcon sx={{fontSize:'1rem',color:'rgba(255,255,255,0.4)'}}/>}{remoteStates[v.socketId]?.camOff?<VideocamOffIcon sx={{fontSize:'1rem',color:'#ef4444'}}/>:<VideocamIcon sx={{fontSize:'1rem',color:'rgba(255,255,255,0.4)'}}/>}</div>
                            {canModerate&&(
                            <div className={styles.hostParticipantActions}>
                                <button className={styles.hostActionBtn} onClick={()=>hostMuteMic(v.socketId)}>🔇</button>
                                <button className={styles.hostActionBtn} onClick={()=>hostUnmuteReq(v.socketId)}>🎙️</button>
                                <button className={styles.hostActionBtn} onClick={()=>hostMuteCam(v.socketId)}>📷</button>
                                {isHost&&!coHosts.includes(v.socketId)&&<button className={styles.hostActionBtn} onClick={()=>makeCoHost(v.socketId)}>🌟</button>}
                                {isHost&&coHosts.includes(v.socketId)&&<button className={styles.hostActionBtn} onClick={()=>removeCoHost(v.socketId)}>⭐</button>}
                                {isHost&&<button className={styles.hostActionBtn} onClick={()=>hostTransfer(v.socketId)}>👑</button>}
                                <button className={`${styles.hostActionBtn} ${styles.hostKickBtn}`} onClick={()=>setConfirmKick(v.socketId)}>✕</button>
                            </div>)}
                        </div>
                        {confirmKick===v.socketId&&(
                        <div className={styles.kickConfirm}>
                            <span>Remove {getName(v.socketId)}?</span>
                            <button className={styles.kickConfirmYes} onClick={()=>hostKick(v.socketId)}>Remove</button>
                            <button className={styles.kickConfirmNo} onClick={()=>setConfirmKick(null)}>Cancel</button>
                        </div>)}
                    </div>))}
                </div>)}
                {showChat&&(
                <div className={styles.chatContent}>
                    <div className={styles.chattingDisplay} ref={chatDisplayRef} onScroll={handleChatScroll}>
                        {messages.length>0?messages.map((item,idx)=>{
                            const own=item.sender===username;
                            return(<div key={idx} className={`${styles.messageWrapper} ${own?styles.ownMessage:styles.otherMessage}`}>
                                {!own&&<p className={styles.messageSender}>{item.sender}{item.isPrivate&&<span className={styles.privateBadge}>🔒 Private</span>}</p>}
                                {own&&item.isPrivate&&<p className={styles.messageSender}><span className={styles.privateBadge}>🔒 Private</span></p>}
                                <div className={`${styles.messageBubble} ${item.isPrivate?styles.privateBubble:''}`}><p className={styles.messageText}>{item.data}</p></div>
                                {item.timestamp&&<p className={styles.messageTime}>{item.timestamp}</p>}
                            </div>);
                        }):<div className={styles.noMessages}><span>💬</span><p>No messages yet</p><p>Say hello!</p></div>}
                        <div ref={chatBottomRef}></div>
                    </div>
                    {showScrollBtn&&<button className={styles.scrollToBottomBtn} onClick={scrollToBottom}>↓ New messages</button>}
                    {showEmojiPicker&&<div className={styles.emojiPickerContainer}>{EMOJI_LIST.map(e=><button key={e} className={styles.emojiPickerBtn} onClick={()=>insertEmoji(e)}>{e}</button>)}</div>}
                    <div className={styles.privateTo}>
                        <span className={styles.privateToLabel}>To:</span>
                        <select className={styles.privateToSelect} value={privateTarget} onChange={e=>setPrivateTarget(e.target.value)}>
                            <option value="all">Everyone</option>
                            {videos.map(v=><option key={v.socketId} value={v.socketId}>{getName(v.socketId)}</option>)}
                        </select>
                        {privateTarget!=='all'&&<span className={styles.privateLock}>🔒</span>}
                    </div>
                    <div className={styles.chattingArea}>
                        <IconButton onClick={()=>setShowEmojiPicker(p=>!p)} sx={{color:showEmojiPicker?'#fbbf24':'rgba(255,255,255,0.4)','&:hover':{color:'#fbbf24'}}}><span style={{fontSize:'1.2rem'}}>😊</span></IconButton>
                        <TextField value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}} label={privateTarget==='all'?'Message...':'Private message...'} variant="outlined" size="small" sx={darkFieldSx}/>
                        <Button variant='contained' onClick={sendMessage} sx={{background:privateTarget==='all'?'#3b82f6':'#7c3aed','&:hover':{background:privateTarget==='all'?'#2563eb':'#6d28d9'},borderRadius:'12px',minWidth:'60px',textTransform:'none',fontWeight:600,boxShadow:'none',padding:'8px 14px',flexShrink:0}}>Send</Button>
                    </div>
                </div>)}
            </div>)}

            {/* SHORTCUTS MODAL */}
            {showShortcutsHelp&&(
            <div className={styles.shortcutsOverlay} onClick={()=>setShowShortcutsHelp(false)}>
                <div className={styles.shortcutsPanel} onClick={e=>e.stopPropagation()}>
                    <div className={styles.shortcutsPanelHeader}><span>Keyboard Shortcuts</span><button className={styles.chatCloseBtn} onClick={()=>setShowShortcutsHelp(false)}>✕</button></div>
                    <div className={styles.shortcutRow}><kbd className={styles.kbd}>M</kbd><span>Toggle microphone</span></div>
                    <div className={styles.shortcutRow}><kbd className={styles.kbd}>V</kbd><span>Toggle camera</span></div>
                    <div className={styles.shortcutRow}><kbd className={styles.kbd}>C</kbd><span>Toggle chat</span></div>
                    <div className={styles.shortcutRow}><kbd className={styles.kbd}>F</kbd><span>Toggle fullscreen</span></div>
                    <div className={styles.shortcutRow}><kbd className={styles.kbd}>Space</kbd><span>Push-to-talk</span></div>
                </div>
            </div>)}

            {/* QR MODAL */}
            {showQR&&(
            <div className={styles.qrOverlay} onClick={()=>setShowQR(false)}>
                <div className={styles.qrModal} onClick={e=>e.stopPropagation()}>
                    <div className={styles.qrHeader}><span>Scan to join</span><button className={styles.chatCloseBtn} onClick={()=>setShowQR(false)}>✕</button></div>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.href)}`} alt="QR" className={styles.qrImage}/>
                    <div className={styles.qrCode}>{getRoomName()}</div>
                    <p className={styles.qrHint}>Point a phone camera at the QR code to join</p>
                </div>
            </div>)}

            {/* POLL MODAL */}
            {showPollModal&&(
            <div className={styles.qrOverlay} onClick={()=>setShowPollModal(false)}>
                <div className={styles.pollModal} onClick={e=>e.stopPropagation()}>
                    <div className={styles.qrHeader}><span>📊 Create a Poll</span><button className={styles.chatCloseBtn} onClick={()=>setShowPollModal(false)}>✕</button></div>
                    <input className={styles.pollInput} placeholder="Question..." value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)}/>
                    {pollOptions.map((opt,i)=>(
                    <div key={i} className={styles.pollOptionRow}>
                        <input className={styles.pollInput} placeholder={`Option ${i+1}...`} value={opt} onChange={e=>{const n=[...pollOptions];n[i]=e.target.value;setPollOptions(n);}}/>
                        {pollOptions.length>2&&<button className={styles.pollRemoveBtn} onClick={()=>setPollOptions(p=>p.filter((_,idx)=>idx!==i))}>✕</button>}
                    </div>))}
                    {pollOptions.length<4&&<button className={styles.pollAddBtn} onClick={()=>setPollOptions(p=>[...p,''])}>+ Add option</button>}
                    <button className={styles.pollLaunchBtn} onClick={createPoll} disabled={!pollQuestion.trim()||pollOptions.filter(o=>o.trim()).length<2}>Launch Poll</button>
                </div>
            </div>)}

            {/* ACTIVE POLL */}
            {activePoll&&(
            <div className={styles.pollPanel}>
                <div className={styles.pollQuestion}>📊 {activePoll.question}</div>
                {activePoll.options.map((opt,i)=>{
                    const total=Object.keys(pollVotes).length, votes=Object.values(pollVotes).filter(v=>v===i).length, pct=total>0?Math.round(votes/total*100):0;
                    return(
                    <div key={i} className={styles.pollOption} onClick={()=>votePoll(i)}>
                        <div className={`${styles.pollOptionBtn} ${myVote===i?styles.pollOptionSelected:''}`}><span>{opt}</span>{myVote!==null&&<span className={styles.pollPct}>{pct}%</span>}</div>
                        {myVote!==null&&<div className={styles.pollBar} style={{width:`${pct}%`}}></div>}
                    </div>);
                })}
                <p className={styles.pollHint}>{myVote===null?'Tap an option to vote':`${Object.keys(pollVotes).length} vote(s) so far`}</p>
                {canModerate&&<button className={styles.pollCloseBtn} onClick={()=>{setActivePoll(null);socketRef.current?.emit('chat-message','__POLL_END__',username);}}>End Poll</button>}
                {!canModerate&&<button className={styles.pollCloseBtn} onClick={()=>setActivePoll(null)}>Dismiss</button>}
            </div>)}

            {/* CONTROL BAR */}
            <div className={styles.buttonContainers}>
                <div className={styles.controlBar}>
                    <IconButton onClick={handleVideo} className={styles.controlBtn}>{video?<VideocamIcon/>:<VideocamOffIcon/>}</IconButton>
                    <IconButton onClick={handleEndCall} className={styles.endCallBtn}><CallEndIcon/></IconButton>
                    <IconButton onClick={handleAudio} className={styles.controlBtn}>{audio?<MicIcon/>:<MicOffIcon/>}</IconButton>
                    {screenAvailable&&<IconButton onClick={handleScreen} className={`${styles.controlBtn} ${screen?styles.controlBtnActive:''}`}>{screen?<ScreenShareIcon/>:<StopScreenShareIcon/>}</IconButton>}
                    <IconButton onClick={handleRaiseHand} className={`${styles.controlBtn} ${handRaised?styles.handBtn:''}`} title="Raise Hand"><span style={{fontSize:'1.25rem',lineHeight:1}}>✋</span></IconButton>
                    <div className={styles.reactionArea}>
                        {showReactions&&<div className={styles.reactionPicker}>{REACTIONS.map(e=><button key={e} className={styles.reactionBtn} onClick={()=>triggerReaction(e)}>{e}</button>)}</div>}
                        <IconButton onClick={()=>setShowReactions(!showReactions)} className={`${styles.controlBtn} ${showReactions?styles.controlBtnActive:''}`}><span style={{fontSize:'1.25rem',lineHeight:1}}>😊</span></IconButton>
                    </div>
                    <IconButton onClick={()=>setViewMode(p=>p==='grid'?'speaker':'grid')} className={`${styles.controlBtn} ${viewMode==='speaker'?styles.controlBtnActive:''}`} title={viewMode==='grid'?'Speaker view':'Grid view'}>{viewMode==='grid'?<ViewAgendaIcon/>:<GridViewIcon/>}</IconButton>
                    <IconButton onClick={toggleMirror} className={`${styles.controlBtn} ${mirrorVideo?styles.controlBtnActive:''}`} title="Mirror camera"><FlipIcon/></IconButton>
                    <IconButton onClick={toggleFullscreen} className={styles.controlBtn} title="Fullscreen (F)">{isFullscreen?<FullscreenExitIcon/>:<FullscreenIcon/>}</IconButton>
                    <div className={styles.moreMenuArea}>
                        {showMoreMenu&&(
                        <div className={styles.moreMenu}>
                            {isHost&&<button className={styles.moreMenuItem} onClick={()=>{handleRecording();setShowMoreMenu(false);}}>{isRecording?<span className={styles.recordDot}></span>:<span style={{fontSize:'1.1rem'}}>⏺</span>}<span>{isRecording?'Stop Recording':'Record Meeting'}</span></button>}
                            <button className={styles.moreMenuItem} onClick={()=>{toggleCaptions();setShowMoreMenu(false);}}>{captionsOn?<ClosedCaptionIcon/>:<ClosedCaptionOffIcon/>}<span>{captionsOn?'Captions: On':'Turn On Captions'}</span></button>
                            <button className={`${styles.moreMenuItem} ${noiseCancellation?styles.moreMenuItemActive:''}`} onClick={()=>{toggleNoiseCancellation();setShowMoreMenu(false);}}>{noiseCancellation?<WifiIcon/>:<WifiOffIcon/>}<span>{noiseCancellation?'Noise Cancel: On':'Noise Cancellation'}</span></button>
                            {canModerate&&<button className={`${styles.moreMenuItem} ${waitingRoomEnabled?styles.moreMenuItemActive:''}`} onClick={()=>{toggleWaitingRoom();setShowMoreMenu(false);}}><HourglassEmptyIcon/><span>{waitingRoomEnabled?'Waiting Room: On':'Enable Waiting Room'}</span></button>}
                            {isHost&&<button className={styles.moreMenuItem} onClick={()=>{setShowPollModal(true);setShowMoreMenu(false);}}><BarChartIcon/><span>Create Poll</span></button>}
                            <button className={styles.moreMenuItem} onClick={()=>{toggleTheme();setShowMoreMenu(false);}}>{theme==='dark'?<LightModeIcon/>:<DarkModeIcon/>}<span>{theme==='dark'?'Light Mode':'Dark Mode'}</span></button>
                            <button className={styles.moreMenuItem} onClick={()=>{setShowShortcutsHelp(true);setShowMoreMenu(false);}}><KeyboardIcon/><span>Keyboard Shortcuts</span></button>
                        </div>)}
                        <IconButton onClick={()=>setShowMoreMenu(!showMoreMenu)} className={`${styles.controlBtn} ${showMoreMenu?styles.controlBtnActive:''}`} title="More">
                            <MoreVertIcon/>{(isRecording||captionsOn||noiseCancellation)&&<span className={styles.moreActiveDot}></span>}
                        </IconButton>
                    </div>
                    <IconButton onClick={()=>isSidePanelOpen&&showParticipants?closeSidePanel():openSidePanel('participants')} className={`${styles.controlBtn} ${showParticipants?styles.controlBtnActive:''}`}>
                        <Badge badgeContent={waitingParticipants.length} color="warning" sx={{'& .MuiBadge-badge':{fontSize:'0.6rem',minWidth:'16px',height:'16px'}}}><PeopleAltIcon/></Badge>
                    </IconButton>
                    <Badge badgeContent={!showChat?newMessages:0} max={99} color='error'>
                        <IconButton onClick={()=>isSidePanelOpen&&showChat?closeSidePanel():openSidePanel('chat')} className={`${styles.controlBtn} ${showChat?styles.controlBtnActive:''}`}><ChatIcon/></IconButton>
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

            {videos.length===0&&<div className={styles.emptyState}><div className={styles.emptyPulse}></div><p className={styles.emptyTitle}>Waiting for others to join...</p><p className={styles.emptySub}>Share code <strong>{getRoomName()}</strong> to invite</p></div>}

            {/* SPEAKER VIEW */}
            {viewMode==='speaker'&&!pinnedVideo&&videos.length>0&&(()=>{
                const spk=Object.keys(speaking).find(id=>id!=='local'&&speaking[id]&&videos.find(v=>v.socketId===id))||videos[0].socketId;
                const sv=videos.find(v=>v.socketId===spk), rest=videos.filter(v=>v.socketId!==spk);
                return(<div className={styles.conferenceViewSpotlight}>
                    <div className={`${styles.pinnedTile} ${speaking[spk]?styles.speakingTile:''}`}>
                        <video ref={ref=>{if(ref){remoteVideoElsRef.current[spk]=ref;if(sv?.stream&&ref.srcObject!==sv.stream)ref.srcObject=sv.stream;}}} autoPlay></video>
                        <span className={styles.pinnedLabel}>🎤 {getName(spk)}</span>
                        {raisedHands[spk]&&<span className={styles.handBadge}>✋</span>}
                    </div>
                    {rest.length>0&&<div className={styles.thumbnailStrip}>{rest.map(v=><div key={v.socketId} className={`${styles.thumbnailTile} ${speaking[v.socketId]?styles.thumbnailSpeaking:''}`} onClick={()=>setViewMode('grid')}><video ref={ref=>{if(ref){remoteVideoElsRef.current[v.socketId]=ref;if(v.stream&&ref.srcObject!==v.stream)ref.srcObject=v.stream;}}} autoPlay></video></div>)}</div>}
                </div>);
            })()}

            {/* SPOTLIGHT */}
            {pinnedVideo&&(
            <div className={styles.conferenceViewSpotlight}>
                <div className={`${styles.pinnedTile} ${speaking[pinnedVideo.socketId]?styles.speakingTile:''}`} onClick={()=>handlePin(pinnedVideo.socketId)}>
                    <video ref={ref=>{if(ref){remoteVideoElsRef.current[pinnedVideo.socketId]=ref;if(pinnedVideo.stream&&ref.srcObject!==pinnedVideo.stream)ref.srcObject=pinnedVideo.stream;}}} autoPlay></video>
                    {raisedHands[pinnedVideo.socketId]&&<span className={styles.handBadge}>✋</span>}
                    <span className={styles.pinnedLabel}>📌 {getName(pinnedVideo.socketId)} — click to unpin</span>
                </div>
                {otherVideos.length>0&&<div className={styles.thumbnailStrip}>{otherVideos.map(v=><div key={v.socketId} className={`${styles.thumbnailTile} ${speaking[v.socketId]?styles.thumbnailSpeaking:''}`} onClick={()=>handlePin(v.socketId)}><video ref={ref=>{if(ref){remoteVideoElsRef.current[v.socketId]=ref;if(v.stream&&ref.srcObject!==v.stream)ref.srcObject=v.stream;}}} autoPlay></video>{raisedHands[v.socketId]&&<span className={styles.handBadgeSm}>✋</span>}</div>)}</div>}
            </div>)}

            {/* GRID */}
            {!pinnedVideo&&viewMode==='grid'&&(
            <div className={styles.conferenceView} style={getGridStyle(videos.length)}>
                {videos.map(v=>(
                <div key={v.socketId} className={`${styles.participantTile} ${speaking[v.socketId]?styles.speakingTile:''}`}>
                    <video ref={ref=>{if(ref){remoteVideoElsRef.current[v.socketId]=ref;if(v.stream&&ref.srcObject!==v.stream)ref.srcObject=v.stream;}}} autoPlay></video>
                    {raisedHands[v.socketId]&&<span className={styles.handBadge}>✋</span>}
                    {v.socketId===hostSocketId&&<span className={styles.tileHostBadge}>👑</span>}
                    {coHosts.includes(v.socketId)&&<span className={styles.tileCoHostBadge}>🌟</span>}
                    <span className={styles.tileName}>{getName(v.socketId)}</span>
                    <span className={styles.pinHint} onClick={()=>handlePin(v.socketId)}>📌</span>
                    <div className={styles.qualityBars}>
                        {[1,2,3,4].map(level=>(
                        <div key={level} className={styles.qualityBar}
                            style={{height:`${level*4+4}px`, background:(connectionQuality[v.socketId]||4)>=level ? ((connectionQuality[v.socketId]||4)>=4?'#22c55e':(connectionQuality[v.socketId]||4)>=3?'#84cc16':(connectionQuality[v.socketId]||4)>=2?'#f59e0b':'#ef4444') : 'rgba(255,255,255,0.12)', opacity:(connectionQuality[v.socketId]||4)>=level?1:0.3}}
                        ></div>))}
                    </div>
                    {canModerate&&(
                    <div className={styles.hostTileOverlay}>
                        <button className={styles.hostTileBtn} onClick={()=>hostMuteMic(v.socketId)}>🔇</button>
                        <button className={styles.hostTileBtn} onClick={()=>hostMuteCam(v.socketId)}>📷</button>
                        <button className={`${styles.hostTileBtn} ${styles.hostTileKick}`} onClick={()=>setConfirmKick(v.socketId)}>✕</button>
                    </div>)}
                    {confirmKick===v.socketId&&(
                    <div className={styles.kickConfirmOverlay}>
                        <p>Remove {getName(v.socketId)}?</p>
                        <button className={styles.kickConfirmYes} onClick={()=>hostKick(v.socketId)}>Yes, Remove</button>
                        <button className={styles.kickConfirmNo} onClick={()=>setConfirmKick(null)}>Cancel</button>
                    </div>)}
                </div>))}
            </div>)}

            {activeReactions.map(r=><div key={r.id} className={styles.floatingReaction} style={{left:`${r.x}%`}}>{r.emoji}</div>)}

        </div>)}
        </div>
    );
}
