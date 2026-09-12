import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { LockOutlined } from "@mui/icons-material";
import { AuthContext } from "../contexts/AuthContext";

export default function Authentication() {
    const navigate = useNavigate();
    const { handleRegister, handleLogin } = useContext(AuthContext);

    const [formState, setFormState] = useState(0); // 0 = login, 1 = register
    const [name,      setName]      = useState("");
    const [username,  setUsername]  = useState("");
    const [password,  setPassword]  = useState("");
    const [error,     setError]     = useState("");
    const [message,   setMessage]   = useState("");
    const [open,      setOpen]      = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleAuth = async () => {
        setIsLoading(true);
        setError("");
        try {
            if (formState === 0) {
                await handleLogin(username, password);
            }
            if (formState === 1) {
                const result = await handleRegister(name, username, password);
                setMessage(result);
                setOpen(true);
                setUsername(""); setPassword(""); setName("");
                setFormState(0);
            }
        } catch (err) {
            const msg = err?.response?.data?.message
                || (err.code === "ECONNABORTED"
                    ? "Server is waking up — please try again in 30 seconds."
                    : "Server unreachable. Please try again.");
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const inputSx = {
        "& label.Mui-focused":             { color: "#6c63ff" },
        "& .MuiOutlinedInput-root": {
            "& fieldset":              { borderColor: "rgba(255,255,255,0.2)" },
            "&:hover fieldset":        { borderColor: "rgba(255,255,255,0.4)" },
            "&.Mui-focused fieldset":  { borderColor: "#6c63ff" },
        },
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg,#0a0f2e 0%,#0d1b4b 50%,#0a0f2e 100%)",
            display: "flex", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        }}>
            {/* Left panel */}
            <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", padding:"60px 80px", color:"#fff" }}>
                <h1 style={{ fontSize:"2.8rem", fontWeight:800, margin:"0 0 12px", letterSpacing:"-0.5px" }}>DConnect</h1>
                <p style={{ fontSize:"1.1rem", color:"rgba(255,255,255,0.5)", margin:"0 0 48px", maxWidth:"380px", lineHeight:1.6 }}>HD video calls, right in your browser. No downloads, no sign-up friction.</p>
                {[
                    { icon:"🎥", text:"Crystal-clear HD video & audio"     },
                    { icon:"💬", text:"Real-time in-call chat & reactions"  },
                    { icon:"🖥️", text:"One-click screen sharing"            },
                    { icon:"🔒", text:"Secure, end-to-end encrypted calls"  },
                ].map((f,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"18px" }}>
                        <div style={{ width:40, height:40, borderRadius:"12px", background:"rgba(255,255,255,0.07)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.3rem", flexShrink:0 }}>{f.icon}</div>
                        <span style={{ color:"rgba(255,255,255,0.65)", fontSize:"0.92rem" }}>{f.text}</span>
                    </div>
                ))}
            </div>

            {/* Right panel — auth card */}
            <div style={{ width:"460px", display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 40px" }}>
                <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:"24px", padding:"40px 36px", width:"100%", backdropFilter:"blur(12px)", boxShadow:"0 24px 64px rgba(0,0,0,0.4)" }}>

                    <div style={{ display:"flex", justifyContent:"center", marginBottom:"20px" }}>
                        <Avatar sx={{ background:"linear-gradient(135deg,#6c63ff,#3b82f6)", width:52, height:52 }}>
                            <LockOutlined />
                        </Avatar>
                    </div>

                    <h2 style={{ color:"#fff", fontWeight:700, fontSize:"1.4rem", textAlign:"center", margin:"0 0 4px", letterSpacing:"-0.2px" }}>
                        {formState === 0 ? "Welcome back" : "Create account"}
                    </h2>
                    <p style={{ color:"rgba(255,255,255,0.4)", textAlign:"center", margin:"0 0 28px", fontSize:"0.875rem" }}>
                        {formState === 0 ? "Sign in to continue to DConnect" : "Join DConnect for free"}
                    </p>

                    {/* Tab switcher */}
                    <div style={{ display:"flex", background:"rgba(255,255,255,0.06)", borderRadius:"12px", padding:"4px", marginBottom:"24px", gap:"4px" }}>
                        {["Sign In","Sign Up"].map((label,i) => (
                            <button key={i} onClick={()=>{setFormState(i);setError("");}} style={{ flex:1, padding:"10px", border:"none", borderRadius:"9px", cursor:"pointer", fontWeight:600, fontSize:"0.875rem", fontFamily:"inherit", transition:"all 0.2s", background:formState===i?"rgba(255,255,255,0.12)":"transparent", color:formState===i?"#fff":"rgba(255,255,255,0.45)" }}>{label}</button>
                        ))}
                    </div>

                    {/* Fields */}
                    {formState === 1 && (
                        <TextField fullWidth label="Full Name" value={name} onChange={e=>{setName(e.target.value);setError("");}} variant="outlined" margin="normal"
                            sx={{"& label":{color:"rgba(255,255,255,0.5)"},"& .MuiInputBase-input":{color:"#fff"},...inputSx}}
                        />
                    )}
                    <TextField fullWidth label="Username" value={username} onChange={e=>{setUsername(e.target.value);setError("");}} variant="outlined" margin="normal"
                        sx={{"& label":{color:"rgba(255,255,255,0.5)"},"& .MuiInputBase-input":{color:"#fff"},...inputSx}}
                    />
                    <TextField fullWidth label="Password" type="password" value={password}
                        onChange={e=>{setPassword(e.target.value);setError("");}}
                        onKeyDown={e=>e.key==="Enter"&&!isLoading&&handleAuth()}
                        variant="outlined" margin="normal"
                        sx={{"& label":{color:"rgba(255,255,255,0.5)"},"& .MuiInputBase-input":{color:"#fff"},...inputSx}}
                    />

                    {error && (
                        <div style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:"10px", padding:"10px 14px", marginTop:"12px", color:"#fca5a5", fontSize:"0.82rem" }}>
                            {error}
                        </div>
                    )}
                    {open && message && (
                        <div style={{ background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.25)", borderRadius:"10px", padding:"10px 14px", marginTop:"12px", color:"#86efac", fontSize:"0.82rem" }}>
                            {message}
                        </div>
                    )}

                    <Button fullWidth variant="contained" onClick={handleAuth} disabled={isLoading}
                        sx={{ mt:3, py:1.5, background:"linear-gradient(135deg,#6c63ff,#3b82f6)", "&:hover":{background:"linear-gradient(135deg,#5b52ee,#2563eb)"}, "&.Mui-disabled":{background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.25)"}, borderRadius:"10px", textTransform:"none", fontWeight:700, fontSize:"1rem", boxShadow:"none" }}
                    >
                        {isLoading ? (formState===0?"Signing in...":"Creating account...") : (formState===0?"Sign In":"Create Account")}
                    </Button>

                    {/* #12: Forgot password link */}
                    {formState === 0 && (
                        <div style={{ textAlign:"center", marginTop:"16px" }}>
                            <button onClick={()=>navigate("/forgot-password")} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.35)", fontSize:"0.82rem", cursor:"pointer", fontFamily:"inherit", transition:"color 0.15s" }}
                                onMouseOver={e=>e.target.style.color="rgba(255,255,255,0.7)"}
                                onMouseOut={e=>e.target.style.color="rgba(255,255,255,0.35)"}
                            >
                                Forgot your password?
                            </button>
                        </div>
                    )}

                    {/* Guest access */}
                    <div style={{ display:"flex", alignItems:"center", gap:"12px", margin:"20px 0 16px" }}>
                        <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.08)" }}></div>
                        <span style={{ color:"rgba(255,255,255,0.25)", fontSize:"0.75rem" }}>or</span>
                        <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.08)" }}></div>
                    </div>
                    <button onClick={()=>navigate("/guest")} style={{ width:"100%", padding:"12px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", color:"rgba(255,255,255,0.6)", fontSize:"0.875rem", cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s", fontWeight:500 }}
                        onMouseOver={e=>{e.target.style.background="rgba(255,255,255,0.09)";e.target.style.color="#fff";}}
                        onMouseOut={e=>{e.target.style.background="rgba(255,255,255,0.05)";e.target.style.color="rgba(255,255,255,0.6)";}}
                    >
                        Continue as Guest
                    </button>
                </div>
            </div>
        </div>
    );
}
