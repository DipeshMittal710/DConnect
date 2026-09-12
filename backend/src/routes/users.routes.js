import { Router } from "express";
import {
    login, register, verifyToken,
    getUserHistory, addToHistory,
    forgotPassword, resetPassword   // #12: forgot/reset password
} from "../controllers/user.controller.js";

const router = Router();

router.route("/login").post(login);
router.route("/register").post(register);
router.route("/verify_token").get(verifyToken);
router.route("/get_all_activity").get(getUserHistory);
router.route("/add_to_activity").post(addToHistory);
router.route("/forgot_password").post(forgotPassword);   // #12
router.route("/reset_password").post(resetPassword);     // #12

export default router;