import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Divider,
  IconButton,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import LogoutIcon from "@mui/icons-material/Logout";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import AddIcon from "@mui/icons-material/Add";
import { AuthContext } from "../contexts/AuthContext";

function HomeComponent() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");

  const { addToUserHistory } = useContext(AuthContext);

  // join existing meeting
  const handleJoinVideoCall = async () => {
    if (!meetingCode.trim()) return;
    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}`);
  };

  // create a brand-new meeting with a random code
  const handleCreateMeeting = async () => {
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await addToUserHistory(newCode);
    setSnackMsg(`Meeting created! Code: ${newCode}`);
    setSnackOpen(true);
    navigate(`/${newCode}`);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#0f172a,#1e3a8a,#312e81)",
        color: "white",
        overflowX: "hidden",
      }}
    >
      {/* ── NAVBAR ────────────────────────────────────────────────── */}
      <Box
        sx={{
          height: { xs: "60px", sm: "70px", md: "80px" },
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: { xs: "0 16px", sm: "0 32px", md: "0 60px" },
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,.15)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: "8px", sm: "12px" },
          }}
        >
          <VideoCallIcon
            sx={{ fontSize: { xs: 26, sm: 34, md: 40 }, color: "#ff9839" }}
          />
          <h2
            style={{
              margin: 0,
              fontWeight: 700,
              fontSize: "clamp(1rem, 2.5vw, 1.35rem)",
            }}
          >
            DConnect
          </h2>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: "8px", sm: "18px" },
          }}
        >
          <Button
            startIcon={<RestoreIcon />}
            variant="contained"
            color="secondary"
            onClick={() => navigate("/history")}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: { xs: "0.75rem", sm: "0.875rem" },
              px: { xs: 1.5, sm: 2 },
            }}
          >
            History
          </Button>

          <Button
            startIcon={<LogoutIcon />}
            variant="outlined"
            sx={{
              color: "white",
              borderColor: "white",
              textTransform: "none",
              fontWeight: 600,
              fontSize: { xs: "0.75rem", sm: "0.875rem" },
              px: { xs: 1.5, sm: 2 },
              "&:hover": {
                borderColor: "rgba(255,255,255,0.6)",
                background: "rgba(255,255,255,0.08)",
              },
            }}
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("user"); // if you're storing user info
              navigate("/");
            }}
          >
            Logout
          </Button>
        </Box>
      </Box>

      {/* ── MAIN ──────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          justifyContent: { xs: "flex-start", lg: "space-between" },
          alignItems: { xs: "stretch", lg: "center" },
          minHeight: { lg: "calc(100vh - 80px)" },
          padding: {
            xs: "28px 16px 48px",
            sm: "36px 28px 48px",
            md: "48px 52px",
            lg: "60px 90px",
          },
          gap: { xs: "32px", lg: "40px" },
        }}
      >
        {/* LEFT */}
        <Box sx={{ flex: 1, maxWidth: { xs: "100%", lg: "580px" } }}>
          <h1 style={{ marginBottom: "15px" }}>
            <Box
              component="span"
              sx={{
                display: "block",
                fontSize: {
                  xs: "clamp(1.5rem, 7vw, 2rem)",
                  sm: "2.4rem",
                  md: "3rem",
                  lg: "3.4rem",
                },
                lineHeight: { xs: 1.22, lg: 1.2 },
                fontWeight: 800,
                color: "white",
              }}
            >
              Connect with your team
              <br />
              <span style={{ color: "#ff9839" }}>Anywhere. Anytime.</span>
            </Box>
          </h1>

          <p style={{ color: "#d1d5db", marginBottom: "40px" }}>
            <Box
              component="span"
              sx={{
                fontSize: {
                  xs: "0.9rem",
                  sm: "1rem",
                  md: "1.1rem",
                  lg: "1.25rem",
                },
                lineHeight: 1.65,
                display: "block",
                width: { xs: "100%", lg: "80%" },
              }}
            >
              HD video meetings with crystal clear audio, screen sharing,
              instant messaging and secure meeting rooms.
            </Box>
          </p>

          {/* ── JOIN CARD ─────────────────────────────────────────── */}
          <Box
            sx={{
              width: "100%",
              maxWidth: { xs: "100%", lg: "520px" },
              padding: {
                xs: "20px 16px",
                sm: "24px 20px",
                md: "28px",
                lg: "30px",
              },
              background: "rgba(255,255,255,.08)",
              borderRadius: { xs: "16px", md: "20px" },
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 20px 50px rgba(0,0,0,.4)",
            }}
          >
            {/* ── NEW: Create meeting button ─────────────────────── */}
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateMeeting}
              sx={{
                height: { xs: "48px", md: "54px" },
                fontSize: { xs: "0.95rem", md: "1rem" },
                fontWeight: "bold",
                background: "#ff9839",
                borderRadius: "10px",
                textTransform: "none",
                mb: 2.5,
                boxShadow: "0 4px 18px rgba(255,152,57,0.35)",
                "&:hover": { background: "#ff8200" },
              }}
            >
              New Meeting
            </Button>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.12)", mb: 2.5 }}>
              <Typography
                sx={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: "0.78rem",
                  px: 1,
                }}
              >
                or join an existing meeting
              </Typography>
            </Divider>

            <h3
              style={{
                marginBottom: "20px",
                fontWeight: 600,
                fontSize: "1rem",
              }}
            >
              Join a Meeting
            </h3>

            <TextField
              fullWidth
              label="Meeting Code"
              variant="outlined"
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoinVideoCall()}
              InputProps={{
                style: {
                  color: "white",
                  background: "rgba(255,255,255,.1)",
                  borderRadius: "10px",
                },
              }}
              InputLabelProps={{ style: { color: "#ddd" } }}
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              sx={{
                mt: 2,
                height: { xs: "48px", sm: "52px", md: "55px" },
                fontSize: { xs: "1rem", sm: "1.05rem", md: "1.1rem" },
                fontWeight: "bold",
                background: "rgba(255,255,255,0.15)",
                borderRadius: "10px",
                textTransform: "none",
                border: "1px solid rgba(255,255,255,0.25)",
                "&:hover": { background: "rgba(255,255,255,0.22)" },
              }}
              onClick={handleJoinVideoCall}
            >
              Join Meeting
            </Button>
          </Box>
        </Box>

        {/* RIGHT — hidden on mobile */}
        <Box
          sx={{
            flex: 1,
            display: { xs: "none", lg: "flex" },
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img
            src="/logo3.png"
            alt="meeting"
            style={{
              width: "100%",
              maxWidth: "650px",
              filter: "drop-shadow(0 20px 40px rgba(0,0,0,.45))",
            }}
          />
        </Box>
      </Box>

      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        message={snackMsg}
      />
    </Box>
  );
}

export default withAuth(HomeComponent);
