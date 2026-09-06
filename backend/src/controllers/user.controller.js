import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { Meeting } from "../models/meeting.model.js";

const TOKEN_EXPIRY_DAYS = 30;

const login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Please provide username and password" });
    }
    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (isPasswordCorrect) {
            const token = crypto.randomBytes(20).toString("hex");
            // NEW: set expiry 30 days from now
            const tokenExpiry = new Date();
            tokenExpiry.setDate(tokenExpiry.getDate() + TOKEN_EXPIRY_DAYS);
            user.token       = token;
            user.tokenExpiry = tokenExpiry;
            await user.save();
            return res.status(httpStatus.OK).json({ token });
        } else {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid username or password" });
        }
    } catch (e) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: `Something went wrong: ${e}` });
    }
};

const register = async (req, res) => {
    const { name, username, password } = req.body;
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(httpStatus.CONFLICT).json({ message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, username, password: hashedPassword });
        await newUser.save();
        return res.status(httpStatus.CREATED).json({ message: "User registered" });
    } catch (e) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: `Something went wrong: ${e}` });
    }
};

const getUserHistory = async (req, res) => {
    const { token } = req.query;
    try {
        const user = await User.findOne({ token });
        if (!user) return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid or expired session" });

        const meetings = await Meeting.find({ user_id: user.username }).sort({ date: -1 });
        return res.status(httpStatus.OK).json(meetings);
    } catch (e) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: `Something went wrong: ${e}` });
    }
};

const addToHistory = async (req, res) => {
    const { token, meeting_code } = req.body;
    try {
        const user = await User.findOne({ token });
        if (!user) return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid or expired session" });

        // Skip duplicate entries
        const exists = await Meeting.findOne({ user_id: user.username, meetingCode: meeting_code });
        if (!exists) {
            const newMeeting = new Meeting({ user_id: user.username, meetingCode: meeting_code });
            await newMeeting.save();
        }
        return res.status(httpStatus.CREATED).json({ message: "Added code to history" });
    } catch (e) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: `Something went wrong: ${e}` });
    }
};

const verifyToken = async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "No token provided" });

    try {
        const user = await User.findOne({ token });
        if (!user) return res.status(httpStatus.UNAUTHORIZED).json({ success: false, message: "Invalid or expired session" });

        // NEW: check token expiry
        if (user.tokenExpiry && user.tokenExpiry < new Date()) {
            user.token       = undefined;
            user.tokenExpiry = undefined;
            await user.save();
            return res.status(httpStatus.UNAUTHORIZED).json({ success: false, message: "Session expired — please log in again" });
        }

        return res.status(httpStatus.OK).json({ success: true, username: user.username, name: user.name });
    } catch (e) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: `Something went wrong: ${e}` });
    }
};

export { login, register, getUserHistory, addToHistory, verifyToken };