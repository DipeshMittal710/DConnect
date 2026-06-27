import express from "express";
import { createServer } from "node:http";

import { Server } from "socket.io";

import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";

import cors from "cors";
import userRoutes from "./routes/users.routes.js";

const app = express();
const server = createServer(app);
const io = connectToSocket(server);


app.set("port", (process.env.PORT || 8000))
app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.use("/api/v1/users", userRoutes);

const start = async () => {
    app.set("mongo_user")
    const connectionDb = await mongoose.connect("mongodb://dipeshmittal71006_db_user:Deepu7102006@ac-zufwo5w-shard-00-00.yxna5mq.mongodb.net:27017,ac-zufwo5w-shard-00-01.yxna5mq.mongodb.net:27017,ac-zufwo5w-shard-00-02.yxna5mq.mongodb.net:27017/?ssl=true&replicaSet=atlas-4kq353-shard-0&authSource=admin&appName=Cluster0")

    console.log(`MONGO Connected DB HOst: ${connectionDb.connection.host}`)
    server.listen(app.get("port"), () => {
        console.log("LISTENIN ON PORT 8000")
    });



}



start();