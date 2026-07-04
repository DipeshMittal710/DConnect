import { Server } from "socket.io";

let connections = {};
let messages    = {};
let timeOnline  = {};
let lockedRooms = {}; // NEW: server-side room lock state

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

        socket.on("join-call", (path) => {

            // NEW: server-side lock — reject BEFORE the joiner enters the room.
            // No timing hacks, no relying on the host being online to kick.
            if (connections[path] !== undefined &&
                connections[path].length > 0 &&
                lockedRooms[path]) {
                socket.emit("room-locked");
                return;
            }

            if (connections[path] === undefined) {
                connections[path] = [];
            }

            connections[path].push(socket.id);
            timeOnline[socket.id] = new Date();

            for (let a = 0; a < connections[path].length; a++) {
                io.to(connections[path][a]).emit(
                    "user-joined",
                    socket.id,
                    connections[path]
                );
            }

            // Replay stored chat history to the new joiner.
            // System messages (__ prefix) are excluded so stale commands
            // (kick, lock, reactions, captions) are never replayed.
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

        // NEW: dedicated lock-room event — replaces the __HOST_LOCK__ chat hack.
        // The host emits this; the server stores the state and broadcasts to the room.
        socket.on("lock-room", (path, locked) => {
            lockedRooms[path] = locked;
            if (connections[path]) {
                connections[path].forEach(id => {
                    io.to(id).emit("room-lock-status", locked);
                });
            }
        });

        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        socket.on("chat-message", (data, sender) => {

            const [matchingRoom, found] = Object.entries(connections).reduce(
                ([room, isFound], [roomKey, roomValue]) => {
                    if (!isFound && roomValue.includes(socket.id)) {
                        return [roomKey, true];
                    }
                    return [room, isFound];
                },
                ["", false]
            );

            if (found) {

                // Only persist real chat messages — not system commands.
                if (!data.startsWith("__")) {
                    if (messages[matchingRoom] === undefined) {
                        messages[matchingRoom] = [];
                    }
                    messages[matchingRoom].push({
                        sender,
                        data,
                        "socket-id-sender": socket.id
                    });
                }

                console.log("message", matchingRoom, ":", sender, data);

                connections[matchingRoom].forEach(elem => {
                    io.to(elem).emit("chat-message", data, sender, socket.id);
                });
            }

        });

        socket.on("disconnect", () => {

            let key;

            for (const [k, v] of Object.entries(connections)) {
                for (let a = 0; a < v.length; a++) {
                    if (v[a] === socket.id) {
                        key = k;

                        for (let b = 0; b < connections[key].length; b++) {
                            io.to(connections[key][b]).emit("user-left", socket.id);
                        }

                        const index = connections[key].indexOf(socket.id);
                        if (index !== -1) {
                            connections[key].splice(index, 1);
                        }

                        if (connections[key].length === 0) {
                            delete connections[key];
                            delete messages[key];
                            delete lockedRooms[key]; // NEW: unlock when room empties
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