import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, TextField, Button, Alert, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import axios from "axios";
import server from "../environment";

const client = axios.create({ baseURL: `${server}/api/v1/users`, timeout: 60000 });

export default function ForgotPassword() {
    const navigate = useNavigate();

    // Step 1: enter username → get token
    // Step 2: enter token + new password → reset
    const [step,        setStep]        = useState(1);
    const [username,    setUsername]    = useState("");
    const [resetToken,  setResetToken]  = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirm,     setConfirm]     = useState("");
    const [loading,     setLoading]     = useState(false);
    const [error,       setError]       = useState("");
    const [info,        setInfo]        = useState("");
    const [devToken,    setDevToken]    = useState(""); // shown in dev mode only

    const fieldSx = {
        "& .MuiOutlinedInput-root": {
            color: "#fff", borderRadius: "10px",
            "& fieldset":              { borderColor: "rgba(255,255,255,0.2)" },
            "&:hover fieldset":        { borderColor: "rgba(255,255,255,0.4)" },
            "&.Mui-focused fieldset":  { borderColor: "#3b82f6" },
        },
        "& .MuiInputLabel-root":             { color: "rgba(255,255,255,0.5)" },
        "& .MuiInputLabel-root.Mui-focused": { color: "#3b82f6" },
    };

    const handleRequestReset = async () => {
        if (!username.trim()) { setError("Please enter your username"); return; }
        setLoading(true); setError(""); setInfo("");
        try {
            const res = await client.post("/forgot_password", { username: username.trim() });
            setInfo(res.data.message);
            if (res.data.resetToken) {
                setDevToken(res.data.resetToken); // dev mode only
                setResetToken(res.data.resetToken);
            }
            setStep(2);
        } catch (e) {
            setError(e?.response?.data?.message || "Server unreachable. Please try again.");
        } finally { setLoading(false); }
    };

    const handleResetPassword = async () => {
        if (!resetToken.trim())  { setError("Please enter your reset token"); return; }
        if (!newPassword)        { setError("Please enter a new password");   return; }
        if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
        if (newPassword !== confirm) { setError("Passwords do not match");    return; }
        setLoading(true); setError(""); setInfo("");
        try {
            const res = await client.post("/reset_password", { resetToken: resetToken.trim(), newPassword });
            setInfo(res.data.message);
            setTimeout(() => navigate("/auth"), 2000);
        } catch (e) {
            setError(e?.response?.data?.message || "Invalid or expired token. Please request a new one.");
        } finally { setLoading(false); }
    };

    return (
        <Box sx={{
            minHeight: "100vh",
            background: "rgb(1,4,48)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
            padding: "16px",
        }}>
            <Box sx={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: "20px", padding: { xs:"28px 20px", md:"40px 36px" },
                width: "100%", maxWidth: "420px",
                backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
            }}>
                {/* Back */}
                <Box sx={{ display:"flex", alignItems:"center", gap:1, mb:3, cursor:"pointer" }} onClick={()=>step===1?navigate("/auth"):setStep(1)}>
                    <ArrowBackIcon sx={{ color:"rgba(255,255,255,0.4)", fontSize:"1.1rem" }}/>
                    <Typography sx={{ color:"rgba(255,255,255,0.4)", fontSize:"0.85rem" }}>
                        {step===1 ? "Back to login" : "Request new token"}
                    </Typography>
                </Box>

                <Typography sx={{ color:"#fff", fontWeight:700, fontSize:"1.4rem", mb:0.5, letterSpacing:"-0.2px" }}>
                    {step===1 ? "Forgot password?" : "Reset password"}
                </Typography>
                <Typography sx={{ color:"rgba(255,255,255,0.4)", fontSize:"0.875rem", mb:3 }}>
                    {step===1
                        ? "Enter your username and we'll generate a reset token."
                        : "Enter the reset token and choose a new password."}
                </Typography>

                {error && <Alert severity="error" sx={{ mb:2, borderRadius:"10px", background:"rgba(239,68,68,0.12)", color:"#fca5a5", border:"1px solid rgba(239,68,68,0.25)", "& .MuiAlert-icon":{ color:"#fca5a5" } }}>{error}</Alert>}
                {info  && <Alert severity="success" sx={{ mb:2, borderRadius:"10px", background:"rgba(34,197,94,0.1)", color:"#86efac", border:"1px solid rgba(34,197,94,0.2)", "& .MuiAlert-icon":{ color:"#86efac" } }}>{info}</Alert>}

                {step === 1 ? (
                    <Box sx={{ display:"flex", flexDirection:"column", gap:2 }}>
                        <TextField
                            fullWidth label="Username" value={username}
                            onChange={e=>{ setUsername(e.target.value); setError(""); }}
                            onKeyDown={e=>e.key==="Enter"&&handleRequestReset()}
                            variant="outlined" sx={fieldSx}
                        />
                        <Button
                            fullWidth variant="contained" onClick={handleRequestReset}
                            disabled={loading || !username.trim()}
                            sx={{ py:1.5, background:"#3b82f6", "&:hover":{background:"#2563eb"}, "&.Mui-disabled":{background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.25)"}, borderRadius:"10px", textTransform:"none", fontWeight:700, fontSize:"1rem", boxShadow:"none" }}
                        >
                            {loading ? <CircularProgress size={22} sx={{ color:"#fff" }}/> : "Get Reset Token"}
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ display:"flex", flexDirection:"column", gap:2 }}>
                        {devToken && (
                            <Box sx={{ background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.25)", borderRadius:"10px", padding:"12px 14px" }}>
                                <Typography sx={{ color:"#fbbf24", fontSize:"0.72rem", fontWeight:700, mb:"4px" }}>DEV MODE — Reset Token</Typography>
                                <Typography sx={{ color:"#fde68a", fontSize:"0.78rem", fontFamily:"'Courier New',monospace", wordBreak:"break-all" }}>{devToken}</Typography>
                                <Typography sx={{ color:"rgba(255,255,255,0.3)", fontSize:"0.68rem", mt:"6px" }}>In production this would be sent by email.</Typography>
                            </Box>
                        )}
                        <TextField
                            fullWidth label="Reset Token" value={resetToken}
                            onChange={e=>{ setResetToken(e.target.value); setError(""); }}
                            variant="outlined" sx={fieldSx}
                            inputProps={{ style:{ fontFamily:"'Courier New',monospace", fontSize:"0.85rem" } }}
                        />
                        <TextField
                            fullWidth label="New Password" type="password" value={newPassword}
                            onChange={e=>{ setNewPassword(e.target.value); setError(""); }}
                            variant="outlined" sx={fieldSx}
                        />
                        <TextField
                            fullWidth label="Confirm Password" type="password" value={confirm}
                            onChange={e=>{ setConfirm(e.target.value); setError(""); }}
                            onKeyDown={e=>e.key==="Enter"&&handleResetPassword()}
                            variant="outlined" sx={fieldSx}
                        />
                        <Button
                            fullWidth variant="contained" onClick={handleResetPassword}
                            disabled={loading || !resetToken.trim() || !newPassword || !confirm}
                            sx={{ py:1.5, background:"#3b82f6", "&:hover":{background:"#2563eb"}, "&.Mui-disabled":{background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.25)"}, borderRadius:"10px", textTransform:"none", fontWeight:700, fontSize:"1rem", boxShadow:"none" }}
                        >
                            {loading ? <CircularProgress size={22} sx={{ color:"#fff" }}/> : "Reset Password"}
                        </Button>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
