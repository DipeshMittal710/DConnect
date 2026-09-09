import { Server } from "socket.io";

let connections    = {};
let messages       = {};
let timeOnline     = {};
let lockedRooms    = {};
let waitingRooms   = {};
let waitingEnabled = {};
let roomHosts      = {};  // FIX: server-side host tracking  path → socket.id
let roomCoHosts    = {};  // FIX: server-side co-host tracking path → Set<socket.id>

const canModerate = (path, socketId) => {
    if (roomHosts[path] === socketId) return true;
    if (roomCoHosts[path] && roomCoHosts[path].has(socketId)) return true;
    return false;
};

const getAllowedOrigins = () => [
    process.env.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3003",
].filter(Boolean);

export const connectToSocket = (server) => {
    const io = new Server(server, {
        // FIX: Socket.IO CORS now matches Express CORS — no more wildcard
        cors: {
            origin: function(origin, callback) {
                const allowed = getAllowedOrigins();
                if (!origin || allowed.includes(origin)) return callback(null, true);
                return callback(new Error(`Socket CORS: origin ${origin} not allowed`));
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log("SOMETHING CONNECTED");

        socket.on("join-call", (path, name) => {

            // Server-side lock check
            if (connections[path] !== undefined &&
                connections[path].length > 0 &&
                lockedRooms[path]) {
                socket.emit("room-locked");
                return;
            }

            // Waiting room check
            if (waitingEnabled[path] && connections[path] && connections[path].length > 0) {
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

            // FIX: first joiner becomes host server-side
            if (connections[path].length === 1) {
                roomHosts[path]   = socket.id;
                roomCoHosts[path] = new Set();
            }

            for (let a = 0; a < connections[path].length; a++) {
                io.to(connections[path][a]).emit("user-joined", socket.id, connections[path]);
            }

            if (messages[path]) {
                messages[path].forEach(m => {
                    io.to(socket.id).emit("chat-message", m.data, m.sender, m["socket-id-sender"]);
                });
            }
        });

        // FIX: validate caller is host/co-host before changing lock state
        socket.on("lock-room", (path, locked) => {
            if (!canModerate(path, socket.id)) {
                console.log(`Unauthorized lock-room attempt from ${socket.id}`);
                return;
            }
            lockedRooms[path] = locked;
            connections[path]?.forEach(id => io.to(id).emit("room-lock-status", locked));
        });

        // FIX: validate caller before toggling waiting room
        socket.on("set-waiting-room", (path, enabled) => {
            if (!canModerate(path, socket.id)) {
                console.log(`Unauthorized set-waiting-room from ${socket.id}`);
                return;
            }
            waitingEnabled[path] = enabled;
            connections[path]?.forEach(id => io.to(id).emit("waiting-room-status", enabled));
        });

        // FIX: validate caller before admitting
        socket.on("admit-user", (waitingSocketId, path) => {
            if (!canModerate(path, socket.id)) {
                console.log(`Unauthorized admit-user from ${socket.id}`);
                return;
            }
            if (waitingRooms[path]) {
                waitingRooms[path] = waitingRooms[path].filter(w => w.socketId !== waitingSocketId);
            }
            if (!connections[path]) connections[path] = [];
            connections[path].push(waitingSocketId);
            timeOnline[waitingSocketId] = new Date();
            for (let a = 0; a < connections[path].length; a++) {
                io.to(connections[path][a]).emit("user-joined", waitingSocketId, connections[path]);
            }
            if (messages[path]) {
                messages[path].forEach(m => {
                    io.to(waitingSocketId).emit("chat-message", m.data, m.sender, m["socket-id-sender"]);
                });
            }
        });

        // FIX: validate caller before denying
        socket.on("deny-user", (waitingSocketId, path) => {
            if (!canModerate(path, socket.id)) {
                console.log(`Unauthorized deny-user from ${socket.id}`);
                return;
            }
            if (waitingRooms[path]) {
                waitingRooms[path] = waitingRooms[path].filter(w => w.socketId !== waitingSocketId);
            }
            io.to(waitingSocketId).emit("waiting-room-denied");
        });

        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        socket.on("private-message", (toId, data, sender) => {
            io.to(toId).emit("private-message", data, sender, socket.id);
            if (toId !== socket.id) socket.emit("private-message", data, sender, socket.id);
        });

        socket.on("chat-message", (data, sender) => {
            const [matchingRoom, found] = Object.entries(connections).reduce(
                ([room, isFound], [roomKey, roomValue]) => {
                    if (!isFound && roomValue.includes(socket.id)) return [roomKey, true];
                    return [room, isFound];
                }, ["", false]
            );

            if (found) {
                // FIX: validate host/co-host commands server-side
                // Any __HOST_* or __COHOST_* message must come from an authorized socket
                if (data.startsWith("__HOST_") || data.startsWith("__COHOST_")) {
                    if (!canModerate(matchingRoom, socket.id)) {
                        console.log(`Unauthorized host command from ${socket.id}: ${data}`);
                        return; // Drop the message — never broadcast unauthorized commands
                    }

                    // FIX: update server-side host/co-host state when transfers happen
                    if (data.startsWith("__HOST_TRANSFER__:")) {
                        const newHostId = data.replace("__HOST_TRANSFER__:", "");
                        if (roomHosts[matchingRoom] === socket.id) {
                            roomHosts[matchingRoom] = newHostId;
                            roomCoHosts[matchingRoom]?.delete(newHostId);
                        }
                    }
                    if (data.startsWith("__COHOST_ADD__:")) {
                        const targetId = data.replace("__COHOST_ADD__:", "");
                        if (roomHosts[matchingRoom] === socket.id) {
                            if (!roomCoHosts[matchingRoom]) roomCoHosts[matchingRoom] = new Set();
                            roomCoHosts[matchingRoom].add(targetId);
                        }
                    }
                    if (data.startsWith("__COHOST_REMOVE__:")) {
                        const targetId = data.replace("__COHOST_REMOVE__:", "");
                        if (roomHosts[matchingRoom] === socket.id) {
                            roomCoHosts[matchingRoom]?.delete(targetId);
                        }
                    }
                }

                // Only persist real chat messages (not system commands)
                if (!data.startsWith("__")) {
                    if (!messages[matchingRoom]) messages[matchingRoom] = [];
                    messages[matchingRoom].push({ sender, data, "socket-id-sender": socket.id });
                }

                console.log("message", matchingRoom, ":", sender, data);
                connections[matchingRoom].forEach(elem => {
                    io.to(elem).emit("chat-message", data, sender, socket.id);
                });
            }
        });

        socket.on("disconnect", () => {
            // Remove from waiting rooms
            for (const [path, waiters] of Object.entries(waitingRooms)) {
                const idx = waiters.findIndex(w => w.socketId === socket.id);
                if (idx !== -1) {
                    waitingRooms[path].splice(idx, 1);
                    connections[path]?.forEach(id => io.to(id).emit("waiting-user-left", socket.id));
                }
            }

            for (const [k, v] of Object.entries(connections)) {
                for (let a = 0; a < v.length; a++) {
                    if (v[a] === socket.id) {
                        const key = k;
                        for (let b = 0; b < connections[key].length; b++) {
                            io.to(connections[key][b]).emit("user-left", socket.id);
                        }
                        const index = connections[key].indexOf(socket.id);
                        if (index !== -1) connections[key].splice(index, 1);
                        roomCoHosts[key]?.delete(socket.id);

                        if (connections[key].length === 0) {
                            delete connections[key];
                            delete messages[key];
                            delete lockedRooms[key];
                            delete waitingRooms[key];
                            delete waitingEnabled[key];
                            delete roomHosts[key];
                            delete roomCoHosts[key];
                        } else if (roomHosts[key] === socket.id) {
                            // FIX: host left — auto-promote oldest co-host or first remaining participant
                            const nextHost =
                                (roomCoHosts[key]?.size > 0 ? roomCoHosts[key].values().next().value : null)
                                || connections[key][0];
                            roomHosts[key] = nextHost;
                            roomCoHosts[key]?.delete(nextHost);
                            // Announce new host to everyone
                            connections[key].forEach(id => {
                                io.to(id).emit("chat-message", `__HOST_CLAIM__:${nextHost}`, "server", "server");
                            });
                        }
                        break;
                    }
                }
            }

            delete timeOnline[socket.id];
        });
    });

    return io;
};