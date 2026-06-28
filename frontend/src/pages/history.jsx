import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Box, Card, CardContent, Typography, IconButton, Chip } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import HistoryIcon from "@mui/icons-material/History";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import VideoCallIcon from "@mui/icons-material/VideoCall";

export default function History() {
  const { getHistoryOfUser } = useContext(AuthContext);
  const [meetings, setMeetings] = useState([]);
  const routeTo = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await getHistoryOfUser();
        setMeetings(history);
      } catch {}
    };
    fetchHistory();
  }, []);

  const formatDate = (dateString) => {
    const date  = new Date(dateString);
    const day   = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year  = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <Box sx={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#0f172a,#111827,#1e293b)",
      p: { xs: 2, sm: 3, md: 4 },
    }}>

      {/* Header */}
      <Box sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 2,
        mb: { xs: 3, sm: 5 },
      }}>
        <Box display="flex" alignItems="center" gap={2}>
          <HistoryIcon sx={{ color: "#60a5fa", fontSize: { xs: 28, sm: 40 } }} />
          <Typography variant="h4" sx={{
            color: "white", fontWeight: "bold",
            fontSize: { xs: "1.25rem", sm: "1.75rem", md: "2.125rem" },
          }}>
            Meeting History
          </Typography>
        </Box>

        <IconButton
          onClick={() => routeTo("/home")}
          sx={{
            bgcolor: "#2563eb", color: "white",
            width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 },
            "&:hover": { bgcolor: "#1d4ed8" },
          }}
        >
          <HomeIcon />
        </IconButton>
      </Box>

      {meetings.length === 0 ? (
        <Typography sx={{
          color: "white", textAlign: "center", mt: 10,
          fontSize: { xs: 16, sm: 20, md: 22 },
        }}>
          No Meeting History Found
        </Typography>
      ) : (
        <Box sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
          gap: { xs: 2, sm: 3 },
        }}>
          {meetings.map((meeting, index) => (
            <Card key={index} sx={{
              borderRadius: 4,
              background: "#1e293b",
              color: "white",
              transition: "0.3s",
              boxShadow: "0 10px 25px rgba(0,0,0,.35)",
              "&:hover": {
                transform: { xs: "none", sm: "translateY(-8px)" },
                boxShadow: "0 18px 35px rgba(0,0,0,.5)",
              },
            }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Chip icon={<VideoCallIcon />} label="Meeting" color="primary" sx={{ mb: 3 }} />

                <Typography variant="h6" sx={{
                  display: "flex", alignItems: "center",
                  flexWrap: "wrap", gap: 1, mb: 2,
                  fontSize: { xs: "0.95rem", sm: "1.1rem", md: "1.25rem" },
                }}>
                  🎥 Code:
                  <Typography component="span" sx={{
                    color: "#38bdf8", fontWeight: "bold",
                    fontSize: "inherit", wordBreak: "break-all",
                  }}>
                    {meeting.meetingCode}
                  </Typography>
                </Typography>

                <Typography sx={{
                  display: "flex", alignItems: "center", gap: 1, color: "#cbd5e1",
                  fontSize: { xs: "0.85rem", sm: "1rem" },
                }}>
                  <CalendarMonthIcon fontSize="small" />
                  {formatDate(meeting.date)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}