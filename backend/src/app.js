import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";
import cors from "cors";
import userRoutes from "./routes/users.routes.js";

const app    = express();
const server = createServer(app);
const io     = connectToSocket(server);

if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not defined in .env — server cannot start");
}

app.set("port", process.env.PORT || 8000);

// FIXED CORS: allow both the deployed frontend AND localhost for development.
// Previously only FRONTEND_URL was allowed, so any request from localhost:3000
// was blocked by CORS before reaching any route handler.
const allowedOrigins = [
    process.env.FRONTEND_URL,          // e.g. https://dconnectfrontend.onrender.com
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3003",
].filter(Boolean); // remove undefined if FRONTEND_URL is not set

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
}));

app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.use("/api/v1/users", userRoutes);

const start = async () => {
    const connectionDb = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MONGO Connected — DB Host: ${connectionDb.connection.host}`);
    server.listen(app.get("port"), () => {
        console.log(`Listening on port ${app.get("port")}`);
    });
};

start();