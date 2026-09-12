import httpStatus from "http-status";
import { User }    from "../models/user.model.js";
import bcrypt      from "bcrypt";
import crypto      from "crypto";
import { Meeting } from "../models/meeting.model.js";

const TOKEN_EXPIRY_DAYS   = 30;
const RESET_EXPIRY_HOURS  = 1;

// ── HELPERS ───────────────────────────────────────────────────────────────
const isExpired = (date) => date && date < new Date();

// ── LOGIN ─────────────────────────────────────────────────────────────────
const login = async (req, res) => {
    const { username, password } = req.body;
    if (!username?.trim() || !password) return res.status(httpStatus.BAD_REQUEST).json({ message: "Please provide username and password" });
    try {
        const user = await User.findOne({ username: username.trim() });
        if (!user) return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid username or password" });

        const token      = crypto.randomBytes(20).toString("hex");
        const tokenExpiry = new Date(); tokenExpiry.setDate(tokenExpiry.getDate() + TOKEN_EXPIRY_DAYS);
        user.token = token; user.tokenExpiry = tokenExpiry;
        await user.save();
        return res.status(httpStatus.OK).json({ token });
    } catch (e) { return res.status(500).json({ message: `Something went wrong: ${e}` }); }
};

// ── REGISTER ──────────────────────────────────────────────────────────────
const register = async (req, res) => {
    const { name, username, password } = req.body;
    if (!name?.trim() || !username?.trim() || !password) return res.status(httpStatus.BAD_REQUEST).json({ message: "All fields are required" });
    if (username.trim().length < 3) return res.status(httpStatus.BAD_REQUEST).json({ message: "Username must be at least 3 characters" });
    if (password.length < 6) return res.status(httpStatus.BAD_REQUEST).json({ message: "Password must be at least 6 characters" });
    try {
        const existing = await User.findOne({ username: username.trim() });
        if (existing) return res.status(httpStatus.CONFLICT).json({ message: "User already exists" });
        const hashed = await bcrypt.hash(password, 10);
        await new User({ name: name.trim(), username: username.trim(), password: hashed }).save();
        return res.status(httpStatus.CREATED).json({ message: "User registered" });
    } catch (e) { return res.status(500).json({ message: `Something went wrong: ${e}` }); }
};

// ── VERIFY TOKEN ──────────────────────────────────────────────────────────
const verifyToken = async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "No token provided" });
    try {
        const user = await User.findOne({ token });
        if (!user) return res.status(httpStatus.UNAUTHORIZED).json({ success: false, message: "Invalid session" });
        if (isExpired(user.tokenExpiry)) {
            user.token = undefined; user.tokenExpiry = undefined; await user.save();
            return res.status(httpStatus.UNAUTHORIZED).json({ success: false, message: "Session expired — please log in again" });
        }
        return res.status(httpStatus.OK).json({ success: true, username: user.username, name: user.name });
    } catch (e) { return res.status(500).json({ success: false, message: `Something went wrong: ${e}` }); }
};

// ── GET HISTORY ───────────────────────────────────────────────────────────
const getUserHistory = async (req, res) => {
    const { token } = req.query;
    try {
        const user = await User.findOne({ token });
        if (!user || isExpired(user.tokenExpiry)) return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid or expired session" });
        const meetings = await Meeting.find({ user_id: user.username }).sort({ date: -1 });
        return res.status(httpStatus.OK).json(meetings);
    } catch (e) { return res.status(500).json({ message: `Something went wrong: ${e}` }); }
};

// ── ADD TO HISTORY ────────────────────────────────────────────────────────
const addToHistory = async (req, res) => {
    const { token, meeting_code } = req.body;
    if (!meeting_code?.trim()) return res.status(httpStatus.BAD_REQUEST).json({ message: "Meeting code required" });
    try {
        const user = await User.findOne({ token });
        if (!user || isExpired(user.tokenExpiry)) return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid or expired session" });
        const exists = await Meeting.findOne({ user_id: user.username, meetingCode: meeting_code.trim() });
        if (!exists) await new Meeting({ user_id: user.username, meetingCode: meeting_code.trim() }).save();
        return res.status(httpStatus.CREATED).json({ message: "Added to history" });
    } catch (e) { return res.status(500).json({ message: `Something went wrong: ${e}` }); }
};

// ── #12: FORGOT PASSWORD ──────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
    const { username } = req.body;
    if (!username?.trim()) return res.status(httpStatus.BAD_REQUEST).json({ message: "Username required" });
    try {
        const user = await User.findOne({ username: username.trim() });
        // Always return 200 so usernames can't be enumerated
        if (!user) return res.status(httpStatus.OK).json({ message: "If that username exists, a reset token has been generated." });

        const resetToken       = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + RESET_EXPIRY_HOURS * 3600000);
        user.resetToken = resetToken; user.resetTokenExpiry = resetTokenExpiry;
        await user.save();

        // In production: send resetToken via email (configure nodemailer in .env)
        // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
        // For now: return the token in dev mode only
        const isDev = process.env.NODE_ENV !== "production";
        return res.status(httpStatus.OK).json({
            message: "Password reset token generated. Check your email (or the token below in dev mode).",
            ...(isDev && { resetToken, expiresIn: `${RESET_EXPIRY_HOURS} hour(s)` })
        });
    } catch (e) { return res.status(500).json({ message: `Something went wrong: ${e}` }); }
};

// ── #12: RESET PASSWORD ───────────────────────────────────────────────────
const resetPassword = async (req, res) => {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) return res.status(httpStatus.BAD_REQUEST).json({ message: "Token and new password are required" });
    if (newPassword.length < 6) return res.status(httpStatus.BAD_REQUEST).json({ message: "Password must be at least 6 characters" });
    try {
        const user = await User.findOne({ resetToken, resetTokenExpiry: { $gt: new Date() } });
        if (!user) return res.status(httpStatus.BAD_REQUEST).json({ message: "Invalid or expired reset token" });

        user.password         = await bcrypt.hash(newPassword, 10);
        user.resetToken       = undefined;
        user.resetTokenExpiry = undefined;
        user.token            = undefined; // invalidate existing sessions
        user.tokenExpiry      = undefined;
        await user.save();

        return res.status(httpStatus.OK).json({ message: "Password reset successfully. Please log in with your new password." });
    } catch (e) { return res.status(500).json({ message: `Something went wrong: ${e}` }); }
};

export { login, register, verifyToken, getUserHistory, addToHistory, forgotPassword, resetPassword };