import { Server } from "socket.io";

let connections    = {};
let messages       = {};
let timeOnline     = {};
let lockedRooms    = {};
let waitingRooms   = {};  // NEW: path → [{socketId, name}]
let waitingEnabled = {};  // NEW: path → boolean

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log("SOMETHING CONNECTED");

        // join-call now accepts an optional name for waiting room display
        socket.on("join-call", (path, name) => {

            // Server-side lock check
            if (connections[path] !== undefined &&
                connections[path].length > 0 &&
                lockedRooms[path]) {
                socket.emit("room-locked");
                return;
            }

            // NEW: Waiting room check
            if (waitingEnabled[path] && connections[path] && connections[path].length > 0) {
                if (!waitingRooms[path]) waitingRooms[path] = [];
                const entry = { socketId: socket.id, name: name || "Guest" };
                waitingRooms[path].push(entry);
                // Tell the joiner they're in the waiting room
                socket.emit("waiting-room-queued");
                // Tell everyone already in the room that someone is waiting
                connections[path].forEach(id => {
                    io.to(id).emit("user-waiting", entry);
                });
                return;
            }

            if (connections[path] === undefined) connections[path] = [];
            connections[path].push(socket.id);
            timeOnline[socket.id] = new Date();

            for (let a = 0; a < connections[path].length; a++) {
                io.to(connections[path][a]).emit("user-joined", socket.id, connections[path]);
            }

            if (messages[path] !== undefined) {
                for (let a = 0; a < messages[path].length; a++) {
                    io.to(socket.id).emit(
                        "chat-message",
                        messages[path][a]["data"],
                        messages[path][a]["sender"],
                        messages[path][a]["socket-id-sender"]
                    );
                }
            }
        });

        // NEW: host toggles waiting room on/off
        socket.on("set-waiting-room", (path, enabled) => {
            waitingEnabled[path] = enabled;
            // Broadcast new status to everyone in room
            if (connections[path]) {
                connections[path].forEach(id => io.to(id).emit("waiting-room-status", enabled));
            }
        });

        // NEW: host admits a waiting participant
        socket.on("admit-user", (waitingSocketId, path) => {
            // Remove from waiting list
            if (waitingRooms[path]) {
                waitingRooms[path] = waitingRooms[path].filter(w => w.socketId !== waitingSocketId);
            }

            // Do the actual join for the admitted socket
            if (!connections[path]) connections[path] = [];
            connections[path].push(waitingSocketId);
            timeOnline[waitingSocketId] = new Date();

            // Notify everyone including the admitted user
            for (let a = 0; a < connections[path].length; a++) {
                io.to(connections[path][a]).emit("user-joined", waitingSocketId, connections[path]);
            }

            // Replay chat history to admitted user
            if (messages[path]) {
                messages[path].forEach(m => {
                    io.to(waitingSocketId).emit("chat-message", m.data, m.sender, m["socket-id-sender"]);
                });
            }
        });

        // NEW: host denies a waiting participant
        socket.on("deny-user", (waitingSocketId, path) => {
            if (waitingRooms[path]) {
                waitingRooms[path] = waitingRooms[path].filter(w => w.socketId !== waitingSocketId);
            }
            io.to(waitingSocketId).emit("waiting-room-denied");
        });

        // Lock/unlock room
        socket.on("lock-room", (path, locked) => {
            lockedRooms[path] = locked;
            if (connections[path]) {
                connections[path].forEach(id => io.to(id).emit("room-lock-status", locked));
            }
        });

        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        // NEW: private message — only goes to sender + target
        socket.on("private-message", (toId, data, sender) => {
            io.to(toId).emit("private-message", data, sender, socket.id);
            // Echo back to sender too so they see it in their own chat
            if (toId !== socket.id) {
                socket.emit("private-message", data, sender, socket.id);
            }
        });

        socket.on("chat-message", (data, sender) => {
            const [matchingRoom, found] = Object.entries(connections).reduce(
                ([room, isFound], [roomKey, roomValue]) => {
                    if (!isFound && roomValue.includes(socket.id)) return [roomKey, true];
                    return [room, isFound];
                },
                ["", false]
            );

            if (found) {
                // Only persist real chat messages, not system commands
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
            let key;

            // Also remove from waiting rooms
            for (const [path, waiters] of Object.entries(waitingRooms)) {
                const idx = waiters.findIndex(w => w.socketId === socket.id);
                if (idx !== -1) {
                    waitingRooms[path].splice(idx, 1);
                    // Notify room that waiter left
                    connections[path]?.forEach(id => {
                        io.to(id).emit("waiting-user-left", socket.id);
                    });
                }
            }

            for (const [k, v] of Object.entries(connections)) {
                for (let a = 0; a < v.length; a++) {
                    if (v[a] === socket.id) {
                        key = k;
                        for (let b = 0; b < connections[key].length; b++) {
                            io.to(connections[key][b]).emit("user-left", socket.id);
                        }
                        const index = connections[key].indexOf(socket.id);
                        if (index !== -1) connections[key].splice(index, 1);
                        if (connections[key].length === 0) {
                            delete connections[key];
                            delete messages[key];
                            delete lockedRooms[key];
                            delete waitingRooms[key];
                            delete waitingEnabled[key];
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