import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import { Button, IconButton, TextField } from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import LogoutIcon from "@mui/icons-material/Logout";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import { AuthContext } from "../contexts/AuthContext";

function HomeComponent() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");

  const { addToUserHistory } = useContext(AuthContext);

  const handleJoinVideoCall = async () => {
    if (!meetingCode.trim()) return;

    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg,#0f172a,#1e3a8a,#312e81)",
        color: "white",
        overflow: "hidden",
      }}
    >
      {/* Navbar */}

      <div
        style={{
          height: "80px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 60px",
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,.15)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <VideoCallIcon sx={{ fontSize: 40, color: "#ff9839" }} />

          <h2
            style={{
              margin: 0,
              fontWeight: 700,
            }}
          >
            DConnect
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
          }}
        >
          <Button
            startIcon={<RestoreIcon />}
            variant="contained"
            color="secondary"
            onClick={() => navigate("/history")}
          >
            History
          </Button>

          <Button
            startIcon={<LogoutIcon />}
            variant="outlined"
            sx={{
              color: "white",
              borderColor: "white",
            }}
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/auth");
            }}
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Main */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          minHeight: "calc(100vh - 80px)",
          padding: "60px 90px",
        }}
      >
        {/* Left */}

        <div
          style={{
            flex: 1,
          }}
        >
          <h1
            style={{
              fontSize: "55px",
              marginBottom: "15px",
              lineHeight: "70px",
            }}
          >
            Connect with your team
            <br />
            <span style={{ color: "#ff9839" }}>
              Anywhere. Anytime.
            </span>
          </h1>

          <p
            style={{
              color: "#d1d5db",
              fontSize: "20px",
              marginBottom: "40px",
              width: "80%",
            }}
          >
            HD video meetings with crystal clear audio, screen sharing,
            instant messaging and secure meeting rooms.
          </p>

          <div
            style={{
              width: "520px",
              padding: "30px",
              background: "rgba(255,255,255,.08)",
              borderRadius: "20px",
              backdropFilter: "blur(20px)",
              boxShadow: "0 20px 50px rgba(0,0,0,.4)",
            }}
          >
            <h3
              style={{
                marginBottom: "20px",
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
              InputProps={{
                style: {
                  color: "white",
                  background: "rgba(255,255,255,.1)",
                  borderRadius: "10px",
                },
              }}
              InputLabelProps={{
                style: {
                  color: "#ddd",
                },
              }}
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              sx={{
                mt: 3,
                height: "55px",
                fontSize: "18px",
                fontWeight: "bold",
                background: "#ff9839",
                "&:hover": {
                  background: "#ff8200",
                },
              }}
              onClick={handleJoinVideoCall}
            >
              Join Meeting
            </Button>
          </div>
        </div>

        {/* Right */}

        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <img
            src="/logo3.png"
            alt="meeting"
            style={{
              width: "650px",
              maxWidth: "100%",
              filter: "drop-shadow(0 20px 40px rgba(0,0,0,.45))",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default withAuth(HomeComponent);