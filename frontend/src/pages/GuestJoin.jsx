import * as React from "react";
import {
  Box,
  Button,
  CssBaseline,
  Grid,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import { useNavigate } from "react-router-dom";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#3b82f6" },
    background: {
      default: "rgb(1,4,48)",
      paper: "rgba(255,255,255,.04)",
    },
  },
});

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "#fff",
    borderRadius: "10px",
    "& fieldset": {
      borderColor: "rgba(255,255,255,.14)",
    },
    "&:hover fieldset": {
      borderColor: "rgba(255,255,255,.3)",
    },
    "&.Mui-focused fieldset": {
      borderColor: "#3b82f6",
    },
  },
  "& .MuiInputLabel-root": {
    color: "rgba(255,255,255,.45)",
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: "#3b82f6",
  },
};

export default function GuestJoin() {
  const navigate = useNavigate();

  const [name, setName] = React.useState("");
  const [meetingCode, setMeetingCode] = React.useState("");

  const handleJoin = () => {
    if (!name.trim() || !meetingCode.trim()) return;

    localStorage.setItem("guestName", name);

    navigate(`/${meetingCode.toUpperCase()}`);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <Grid container component="main" sx={{ minHeight: "100vh" }}>
        <CssBaseline />

        {/* LEFT PANEL */}

        <Grid
          item
          xs={false}
          sm={4}
          md={7}
          sx={{
            background:
              "linear-gradient(135deg,rgb(1,4,48) 0%, rgb(6,14,65) 55%, rgb(2,7,52) 100%)",
            display: { xs: "none", sm: "flex" },
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box sx={{ maxWidth: 450 }}>
            <Typography
              variant="h3"
              sx={{
                color: "#fff",
                fontWeight: 700,
                mb: 2,
              }}
            >
              DConnect
            </Typography>

            <Typography
              sx={{
                color: "rgba(255,255,255,.45)",
                fontSize: "1rem",
                mb: 5,
              }}
            >
              Join any meeting instantly without creating an account.
            </Typography>

            <Typography sx={{ color: "#fff", mb: 2 }}>
              🎥 Crystal-clear HD meetings
            </Typography>

            <Typography sx={{ color: "#fff", mb: 2 }}>
              💬 Live chat & reactions
            </Typography>

            <Typography sx={{ color: "#fff", mb: 2 }}>
              🖥 Screen sharing
            </Typography>

            <Typography sx={{ color: "#fff" }}>
              🔒 Secure meeting rooms
            </Typography>
          </Box>
        </Grid>

        {/* RIGHT PANEL */}

        <Grid
          item
          xs={12}
          sm={8}
          md={5}
          sx={{
            background: "rgb(1,4,48)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: "100%",
              maxWidth: 420,
              p: 4,
              bgcolor: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
              backdropFilter: "blur(14px)",
              borderRadius: 4,
            }}
          >
            <Box
              sx={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "#3b82f6",
                mb: 2,
              }}
            >
              <MeetingRoomIcon />
            </Box>

            <Typography
              variant="h4"
              sx={{
                color: "#fff",
                fontWeight: 700,
                mb: 1,
              }}
            >
              Join as Guest
            </Typography>

            <Typography
              sx={{
                color: "rgba(255,255,255,.45)",
                mb: 4,
              }}
            >
              Enter your name and the meeting code.
            </Typography>

            <TextField
              fullWidth
              label="Your Name"
              sx={{ ...fieldSx, mb: 2 }}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <TextField
              fullWidth
              label="Meeting Code"
              sx={{ ...fieldSx, mb: 3 }}
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && handleJoin()
              }
            />

            <Button
              fullWidth
              variant="contained"
              sx={{
                py: 1.4,
                fontWeight: 700,
                fontSize: "1rem",
                borderRadius: "10px",
                textTransform: "none",
                bgcolor: "#3b82f6",
                "&:hover": {
                  bgcolor: "#2563eb",
                },
              }}
              onClick={handleJoin}
            >
              Join Meeting
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </ThemeProvider>
  );
}