import { Server } from "socket.io";

let connections    = {};
let messages       = {};
let timeOnline     = {};
let lockedRooms    = {};
let waitingRooms   = {};
let waitingEnabled = {};
let roomHosts      = {};   // path → socket.id of current host
let roomCoHosts    = {};   // path → Set<socket.id>

const canModerate = (path, socketId) =>
    roomHosts[path] === socketId || (roomCoHosts[path]?.has(socketId) ?? false);

const getAllowedOrigins = () =>
    [process.env.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001", "http://localhost:3003"].filter(Boolean);

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: (origin, cb) => {
                const allowed = getAllowedOrigins();
                if (!origin || allowed.includes(origin)) return cb(null, true);
                cb(new Error(`Socket CORS: ${origin} not allowed`));
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log("socket connected:", socket.id);

        // ── JOIN CALL ─────────────────────────────────────────────────────
        socket.on("join-call", (path, name) => {
            if (connections[path]?.length > 0 && lockedRooms[path]) {
                socket.emit("room-locked"); return;
            }
            if (waitingEnabled[path] && connections[path]?.length > 0) {
                if (!waitingRooms[path]) waitingRooms[path] = [];
                const entry = { socketId: socket.id, name: name || "Guest" };
                waitingRooms[path].push(entry);
                socket.emit("waiting-room-queued");
                connections[path].forEach(id => io.to(id).emit("user-waiting", entry));
                return;
            }
            if (!connections[path]) connections[path] = [];
            connections[path].push(socket.id);
            timeOnline[socket.id] = new Date();
            if (connections[path].length === 1) {
                roomHosts[path]   = socket.id;
                roomCoHosts[path] = new Set();
            }
            connections[path].forEach(id => io.to(id).emit("user-joined", socket.id, connections[path]));
            messages[path]?.forEach(m => io.to(socket.id).emit("chat-message", m.data, m.sender, m["socket-id-sender"]));
        });

        // ── #17 FIX: DEDICATED HOST-ACTION EVENT ─────────────────────────
        // Replaces the __HOST_* chat-message piggyback pattern entirely.
        socket.on("host-action", ({ type, targetId, path }) => {
            if (!canModerate(path, socket.id)) {
                console.log(`Unauthorized host-action '${type}' from ${socket.id}`); return;
            }
            switch (type) {
                case "mute-mic":
                    if (!connections[path]?.includes(targetId)) return;
                    io.to(targetId).emit("host-command", { type: "mute-mic" });
                    break;
                case "mute-all":
                    connections[path]?.forEach(id => {
                        if (id !== socket.id) io.to(id).emit("host-command", { type: "mute-mic" });
                    });
                    break;
                case "mute-cam":
                    if (!connections[path]?.includes(targetId)) return;
                    io.to(targetId).emit("host-command", { type: "mute-cam" });
                    break;
                case "unmute-req":
                    if (!connections[path]?.includes(targetId)) return;
                    io.to(targetId).emit("host-command", { type: "unmute-req" });
                    break;
                case "kick":
                    if (!connections[path]?.includes(targetId)) {
                        console.log(`Kick: ${targetId} not in room`); return;
                    }
                    io.to(targetId).emit("force-kicked");
                    connections[path] = connections[path].filter(id => id !== targetId);
                    roomCoHosts[path]?.delete(targetId);
                    connections[path]?.forEach(id => io.to(id).emit("user-left", targetId));
                    const kicked = io.sockets.sockets.get(targetId);
                    if (kicked) setTimeout(() => { try { kicked.disconnect(true); } catch(e){} }, 1800);
                    break;
                case "transfer-host":
                    // Only the actual host (not co-host) can transfer
                    if (roomHosts[path] !== socket.id) {
                        console.log(`Co-host tried to transfer: ${socket.id}`); return;
                    }
                    if (!connections[path]?.includes(targetId)) {
                        console.log(`Transfer target not in room: ${targetId}`); return;
                    }
                    const fromId = roomHosts[path];
                    roomHosts[path] = targetId;
                    roomCoHosts[path]?.delete(targetId);
                    // Broadcast via dedicated event (not chat-message)
                    connections[path]?.forEach(id => io.to(id).emit("host-changed", { newHostId: targetId, fromId }));
                    break;
                default:
                    console.log(`Unknown host-action type: ${type}`);
            }
        });

        // ── #17 FIX: DEDICATED COHOST-ACTION EVENT ───────────────────────
        socket.on("cohost-action", ({ type, targetId, path }) => {
            // Only the host (not co-hosts) can manage co-host roles
            if (roomHosts[path] !== socket.id) {
                console.log(`Unauthorized cohost-action from ${socket.id}`); return;
            }
            if (!connections[path]?.includes(targetId)) {
                console.log(`cohost-action target not in room: ${targetId}`); return;
            }
            if (!roomCoHosts[path]) roomCoHosts[path] = new Set();
            if (type === "add") {
                roomCoHosts[path].add(targetId);
                connections[path]?.forEach(id => io.to(id).emit("cohost-changed", { action: "add", targetId }));
            } else if (type === "remove") {
                roomCoHosts[path].delete(targetId);
                connections[path]?.forEach(id => io.to(id).emit("cohost-changed", { action: "remove", targetId }));
            }
        });

        // ── LOCK ROOM ─────────────────────────────────────────────────────
        socket.on("lock-room", (path, locked) => {
            if (!canModerate(path, socket.id)) return;
            lockedRooms[path] = locked;
            connections[path]?.forEach(id => io.to(id).emit("room-lock-status", locked));
        });

        // ── WAITING ROOM ──────────────────────────────────────────────────
        socket.on("set-waiting-room", (path, enabled) => {
            if (!canModerate(path, socket.id)) return;
            waitingEnabled[path] = enabled;
            connections[path]?.forEach(id => io.to(id).emit("waiting-room-status", enabled));
        });

        socket.on("admit-user", (waitingSocketId, path) => {
            if (!canModerate(path, socket.id)) return;
            const isWaiting = waitingRooms[path]?.some(w => w.socketId === waitingSocketId);
            if (!isWaiting) return;
            waitingRooms[path] = waitingRooms[path].filter(w => w.socketId !== waitingSocketId);
            if (!connections[path]) connections[path] = [];
            connections[path].push(waitingSocketId);
            timeOnline[waitingSocketId] = new Date();
            connections[path].forEach(id => io.to(id).emit("user-joined", waitingSocketId, connections[path]));
            messages[path]?.forEach(m => io.to(waitingSocketId).emit("chat-message", m.data, m.sender, m["socket-id-sender"]));
        });

        socket.on("deny-user", (waitingSocketId, path) => {
            if (!canModerate(path, socket.id)) return;
            const isWaiting = waitingRooms[path]?.some(w => w.socketId === waitingSocketId);
            if (!isWaiting) return;
            waitingRooms[path] = waitingRooms[path].filter(w => w.socketId !== waitingSocketId);
            io.to(waitingSocketId).emit("waiting-room-denied");
        });

        // ── SIGNAL (WebRTC) ───────────────────────────────────────────────
        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        // ── PRIVATE MESSAGE ───────────────────────────────────────────────
        socket.on("private-message", (toId, data, sender) => {
            io.to(toId).emit("private-message", data, sender, socket.id);
            if (toId !== socket.id) socket.emit("private-message", data, sender, socket.id);
        });

        // ── CHAT MESSAGE ──────────────────────────────────────────────────
        socket.on("chat-message", (data, sender) => {
            const [matchingRoom, found] = Object.entries(connections).reduce(
                ([room, isFound], [key, val]) => (!isFound && val.includes(socket.id)) ? [key, true] : [room, isFound],
                ["", false]
            );
            if (!found) return;

            // #17/#18 FIX: all __HOST_* and __COHOST_* commands now arrive via
            // host-action / cohost-action — any that still arrive via chat are
            // legacy or spoofed. Drop them all.
            if (data.startsWith("__HOST_") || data.startsWith("__COHOST_")) {
                console.log(`Blocked legacy host command via chat from ${socket.id}: ${data}`);
                return;
            }

            // Persist real chat only
            if (!data.startsWith("__")) {
                if (!messages[matchingRoom]) messages[matchingRoom] = [];
                messages[matchingRoom].push({ sender, data, "socket-id-sender": socket.id });
            }

            connections[matchingRoom].forEach(id => io.to(id).emit("chat-message", data, sender, socket.id));
        });

        // ── DISCONNECT ────────────────────────────────────────────────────
        socket.on("disconnect", () => {
            // Remove from any waiting room
            for (const [path, waiters] of Object.entries(waitingRooms)) {
                const idx = waiters.findIndex(w => w.socketId === socket.id);
                if (idx !== -1) {
                    waitingRooms[path].splice(idx, 1);
                    connections[path]?.forEach(id => io.to(id).emit("waiting-user-left", socket.id));
                }
            }

            for (const [k, v] of Object.entries(connections)) {
                const idx = v.indexOf(socket.id);
                if (idx === -1) continue;

                // Notify everyone in room
                v.forEach(id => io.to(id).emit("user-left", socket.id));
                v.splice(idx, 1);
                roomCoHosts[k]?.delete(socket.id);

                if (v.length === 0) {
                    delete connections[k]; delete messages[k]; delete lockedRooms[k];
                    delete waitingRooms[k]; delete waitingEnabled[k];
                    delete roomHosts[k]; delete roomCoHosts[k];
                } else if (roomHosts[k] === socket.id) {
                    // Auto-promote: oldest co-host, else first participant
                    const next = (roomCoHosts[k]?.size > 0 ? roomCoHosts[k].values().next().value : null) || v[0];
                    roomHosts[k] = next;
                    roomCoHosts[k]?.delete(next);
                    v.forEach(id => io.to(id).emit("host-changed", { newHostId: next, fromId: socket.id }));
                }
                break;
            }
            delete timeOnline[socket.id];
        });
    });

    return io;
};