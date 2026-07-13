import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, TextField, Typography, Divider, IconButton } from "@mui/material";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import AddIcon from "@mui/icons-material/Add";
import LoginIcon from "@mui/icons-material/Login";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export default function GuestPage() {
  const navigate = useNavigate();

  const [mode,        setMode]        = useState(null); // null | 'create' | 'join'
  const [meetingCode, setMeetingCode] = useState("");
  const [name,        setName]        = useState("");
  const [error,       setError]       = useState("");

  const generatedCode = React.useRef(
    Math.random().toString(36).substring(2, 8).toUpperCase()
  );

  const handleCreate = () => {
    if (!name.trim()) { setError("Please enter your display name"); return; }
    navigate(`/${generatedCode.current}`);
  };

  const handleJoin = () => {
    if (!name.trim())        { setError("Please enter your display name"); return; }
    if (!meetingCode.trim()) { setError("Please enter a meeting code"); return; }
    navigate(`/${meetingCode.trim().toUpperCase()}`);
  };

  const cardSx = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "18px",
    padding: { xs: "24px 20px", md: "32px 28px" },
    cursor: "pointer",
    transition: "all 0.2s",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    flex: 1,
    "&:hover": {
      background: "rgba(255,255,255,0.09)",
      borderColor: "rgba(255,255,255,0.22)",
      transform: "translateY(-3px)",
    },
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      color: "#fff", borderRadius: "10px",
      "& fieldset":              { borderColor: "rgba(255,255,255,0.2)"  },
      "&:hover fieldset":        { borderColor: "rgba(255,255,255,0.4)"  },
      "&.Mui-focused fieldset":  { borderColor: "#3b82f6"                },
    },
    "& .MuiInputLabel-root":            { color: "rgba(255,255,255,0.5)" },
    "& .MuiInputLabel-root.Mui-focused":{ color: "#3b82f6"               },
  };

  return (
    <Box sx={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#0f172a,#1e3a8a,#312e81)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: { xs: "24px 16px", md: "40px 24px" },
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    }}>

      {/* Brand */}
      <Box sx={{ display:"flex", alignItems:"center", gap:"10px", mb:{ xs:4, md:5 } }}>
        <VideoCallIcon sx={{ fontSize:{ xs:32, md:40 }, color:"#ff9839" }} />
        <Typography sx={{
          color:"#fff", fontWeight:700, letterSpacing:"-0.3px",
          fontSize:{ xs:"1.4rem", md:"1.8rem" },
        }}>
          DConnect
        </Typography>
      </Box>

      {/* Card */}
      <Box sx={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: { xs:"18px", md:"24px" },
        padding: { xs:"28px 20px", sm:"36px 32px" },
        width: "100%", maxWidth: "480px",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
      }}>

        {/* ── STEP 1: choose mode ────────────────────────────────────── */}
        {mode === null && (
          <>
            <Typography sx={{
              color:"#fff", fontWeight:700, fontSize:{ xs:"1.2rem", md:"1.35rem" },
              mb:0.5, letterSpacing:"-0.2px",
            }}>
              Join as Guest
            </Typography>
            <Typography sx={{ color:"rgba(255,255,255,0.4)", fontSize:"0.875rem", mb:3 }}>
              No account needed — just pick an option below
            </Typography>

            <Box sx={{ display:"flex", gap:"12px", flexDirection:{ xs:"column", sm:"row" } }}>

              {/* Create */}
              <Box sx={cardSx} onClick={() => { setMode("create"); setError(""); }}>
                <Box sx={{
                  width:52, height:52, borderRadius:"14px",
                  background:"rgba(255,152,57,0.15)", border:"1px solid rgba(255,152,57,0.3)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <AddIcon sx={{ fontSize:"1.6rem", color:"#ff9839" }} />
                </Box>
                <Typography sx={{ color:"#fff", fontWeight:600, fontSize:"0.95rem" }}>
                  New Meeting
                </Typography>
                <Typography sx={{ color:"rgba(255,255,255,0.4)", fontSize:"0.78rem", textAlign:"center" }}>
                  Create a room and share the code
                </Typography>
              </Box>

              {/* Join */}
              <Box sx={cardSx} onClick={() => { setMode("join"); setError(""); }}>
                <Box sx={{
                  width:52, height:52, borderRadius:"14px",
                  background:"rgba(59,130,246,0.15)", border:"1px solid rgba(59,130,246,0.3)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <LoginIcon sx={{ fontSize:"1.6rem", color:"#60a5fa" }} />
                </Box>
                <Typography sx={{ color:"#fff", fontWeight:600, fontSize:"0.95rem" }}>
                  Join Meeting
                </Typography>
                <Typography sx={{ color:"rgba(255,255,255,0.4)", fontSize:"0.78rem", textAlign:"center" }}>
                  Enter a code from your host
                </Typography>
              </Box>

            </Box>

            <Divider sx={{ borderColor:"rgba(255,255,255,0.08)", my:3 }} />

            <Button
              fullWidth variant="outlined"
              onClick={() => navigate("/auth")}
              sx={{
                color:"rgba(255,255,255,0.6)", borderColor:"rgba(255,255,255,0.15)",
                borderRadius:"10px", textTransform:"none", fontWeight:500,
                "&:hover":{ borderColor:"rgba(255,255,255,0.3)", color:"#fff", background:"rgba(255,255,255,0.05)" },
              }}
            >
              Sign in for full access
            </Button>
          </>
        )}

        {/* ── STEP 2a: create meeting ─────────────────────────────────── */}
        {mode === "create" && (
          <>
            <Box sx={{ display:"flex", alignItems:"center", gap:"8px", mb:2 }}>
              <IconButton onClick={() => { setMode(null); setError(""); }}
                sx={{ color:"rgba(255,255,255,0.5)", p:"6px", "&:hover":{ color:"#fff" } }}>
                <ArrowBackIcon sx={{ fontSize:"1.1rem" }} />
              </IconButton>
              <Typography sx={{ color:"#fff", fontWeight:700, fontSize:"1.1rem" }}>
                New Meeting
              </Typography>
            </Box>

            {/* generated code display */}
            <Box sx={{
              background:"rgba(255,152,57,0.08)", border:"1px solid rgba(255,152,57,0.25)",
              borderRadius:"12px", padding:"16px 18px", mb:3, textAlign:"center",
            }}>
              <Typography sx={{ color:"rgba(255,255,255,0.45)", fontSize:"0.72rem", mb:"4px", letterSpacing:"0.5px" }}>
                YOUR MEETING CODE
              </Typography>
              <Typography sx={{
                color:"#ff9839", fontWeight:800, fontSize:"1.6rem",
                letterSpacing:"4px", fontFamily:"'Courier New',Courier,monospace",
              }}>
                {generatedCode.current}
              </Typography>
              <Typography sx={{ color:"rgba(255,255,255,0.3)", fontSize:"0.72rem", mt:"4px" }}>
                Share this with participants
              </Typography>
            </Box>

            <TextField
              fullWidth label="Your display name" value={name}
              onChange={e => { setName(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              variant="outlined" sx={{ ...fieldSx, mb: error ? 1 : 2.5 }}
            />

            {error && (
              <Typography sx={{ color:"#fca5a5", fontSize:"0.78rem", mb:2, pl:"4px" }}>
                {error}
              </Typography>
            )}

            <Button
              fullWidth variant="contained" onClick={handleCreate}
              disabled={!name.trim()}
              sx={{
                py:1.5, background:"#ff9839", borderRadius:"10px",
                textTransform:"none", fontWeight:700, fontSize:"1rem",
                boxShadow:"0 4px 18px rgba(255,152,57,0.35)",
                "&:hover":{ background:"#ff8200" },
                "&.Mui-disabled":{ background:"rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.25)" },
              }}
            >
              Create & Join
            </Button>
          </>
        )}

        {/* ── STEP 2b: join meeting ───────────────────────────────────── */}
        {mode === "join" && (
          <>
            <Box sx={{ display:"flex", alignItems:"center", gap:"8px", mb:2 }}>
              <IconButton onClick={() => { setMode(null); setError(""); }}
                sx={{ color:"rgba(255,255,255,0.5)", p:"6px", "&:hover":{ color:"#fff" } }}>
                <ArrowBackIcon sx={{ fontSize:"1.1rem" }} />
              </IconButton>
              <Typography sx={{ color:"#fff", fontWeight:700, fontSize:"1.1rem" }}>
                Join Meeting
              </Typography>
            </Box>

            <TextField
              fullWidth label="Meeting code" value={meetingCode}
              onChange={e => { setMeetingCode(e.target.value.toUpperCase()); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              variant="outlined" sx={{ ...fieldSx, mb:2 }}
              inputProps={{ style:{ letterSpacing:"3px", fontWeight:700 } }}
            />

            <TextField
              fullWidth label="Your display name" value={name}
              onChange={e => { setName(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              variant="outlined" sx={{ ...fieldSx, mb: error ? 1 : 2.5 }}
            />

            {error && (
              <Typography sx={{ color:"#fca5a5", fontSize:"0.78rem", mb:2, pl:"4px" }}>
                {error}
              </Typography>
            )}

            <Button
              fullWidth variant="contained" onClick={handleJoin}
              disabled={!name.trim() || !meetingCode.trim()}
              sx={{
                py:1.5, background:"#3b82f6", borderRadius:"10px",
                textTransform:"none", fontWeight:700, fontSize:"1rem",
                boxShadow:"0 4px 18px rgba(59,130,246,0.35)",
                "&:hover":{ background:"#2563eb" },
                "&.Mui-disabled":{ background:"rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.25)" },
              }}
            >
              Join Meeting
            </Button>
          </>
        )}

      </Box>

      {/* Footer */}
      <Typography sx={{
        color:"rgba(255,255,255,0.2)", fontSize:"0.75rem",
        mt:3, textAlign:"center",
      }}>
        Guest sessions are temporary. Sign in to save meeting history.
      </Typography>

    </Box>
  );
}
