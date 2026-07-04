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

// FIXED: restrict CORS to the frontend origin (not wildcard)
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.use("/api/v1/users", userRoutes);

const start = async () => {
    // FIXED: removed the useless app.set("mongo_user") line
    const connectionDb = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MONGO Connected — DB Host: ${connectionDb.connection.host}`);

    server.listen(app.get("port"), () => {
        console.log(`Listening on port ${app.get("port")}`);
    });
};

start();