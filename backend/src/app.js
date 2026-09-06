import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";
import cors from "cors";
import rateLimit from "express-rate-limit";
import userRoutes from "./routes/users.routes.js";

const app    = express();
const server = createServer(app);
const io     = connectToSocket(server);

if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not defined in .env — server cannot start");
}

app.set("port", process.env.PORT || 8000);

// CORS — allow deployed frontend + localhost for development
const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3003",
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
}));

app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

// NEW: rate limiting on auth routes — max 20 attempts per 15 minutes
// Run: npm install express-rate-limit
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests — please try again in 15 minutes" }
});
app.use("/api/v1/users/login",    authLimiter);
app.use("/api/v1/users/register", authLimiter);

app.use("/api/v1/users", userRoutes);

const start = async () => {
    const connectionDb = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MONGO Connected — DB Host: ${connectionDb.connection.host}`);
    server.listen(app.get("port"), () => {
        console.log(`Listening on port ${app.get("port")}`);
    });
};

start();