import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
    Box, Typography, Card, CardContent, Chip,
    IconButton, Tooltip, CircularProgress
} from "@mui/material";
import VideocamIcon    from "@mui/icons-material/Videocam";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ReplayIcon      from "@mui/icons-material/Replay";
import ArrowBackIcon   from "@mui/icons-material/ArrowBack";

export default function History() {
    const { getHistoryOfUser } = useContext(AuthContext);
    const [meetings,   setMeetings]   = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [copiedId,   setCopiedId]   = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const data = await getHistoryOfUser();
                setMeetings(data || []);
            } catch (e) {
                console.log("Error fetching history:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) +
            " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const handleCopy = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedId(code);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // NEW: rejoin meeting directly from history
    const handleRejoin = (code) => {
        navigate(`/${code}`);
    };

    const cardSx = {
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: "16px",
        mb: 2,
        transition: "all 0.18s",
        "&:hover": {
            background: "rgba(255,255,255,0.07)",
            borderColor: "rgba(255,255,255,0.16)",
            transform: "translateY(-2px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
        }
    };

    return (
        <Box sx={{
            minHeight: "100vh",
            background: "rgb(1,4,48)",
            fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
            padding: { xs: "20px 16px", md: "40px 32px" },
        }}>
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
                <IconButton onClick={() => navigate("/home")}
                    sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff", background: "rgba(255,255,255,0.08)" } }}>
                    <ArrowBackIcon />
                </IconButton>
                <Box>
                    <Typography sx={{ color: "#fff", fontSize: { xs: "1.4rem", md: "1.8rem" }, fontWeight: 700, letterSpacing: "-0.3px" }}>
                        Meeting History
                    </Typography>
                    <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.875rem", mt: 0.25 }}>
                        {loading ? "" : `${meetings.length} meeting${meetings.length !== 1 ? "s" : ""} recorded`}
                    </Typography>
                </Box>
            </Box>

            {/* Loading */}
            {loading && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
                    <CircularProgress sx={{ color: "#3b82f6" }} />
                </Box>
            )}

            {/* Empty */}
            {!loading && meetings.length === 0 && (
                <Box sx={{ textAlign: "center", mt: 10 }}>
                    <VideocamIcon sx={{ fontSize: "4rem", color: "rgba(255,255,255,0.1)", mb: 2 }} />
                    <Typography sx={{ color: "rgba(255,255,255,0.3)", fontSize: "1rem" }}>
                        No meetings yet
                    </Typography>
                    <Typography sx={{ color: "rgba(255,255,255,0.18)", fontSize: "0.85rem", mt: 1 }}>
                        Join or host a meeting to see it here
                    </Typography>
                </Box>
            )}

            {/* Meeting cards */}
            {!loading && meetings.map((meeting, idx) => (
                <Card key={meeting._id || idx} sx={cardSx} elevation={0}>
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, p: "16px 20px !important" }}>
                        {/* Icon */}
                        <Box sx={{
                            width: 44, height: 44, borderRadius: "12px",
                            background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                            <VideocamIcon sx={{ color: "#60a5fa", fontSize: "1.3rem" }} />
                        </Box>

                        {/* Info */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                <Typography sx={{
                                    color: "#fff", fontWeight: 600, fontSize: "0.95rem",
                                    fontFamily: "'Courier New',Courier,monospace", letterSpacing: "2px"
                                }}>
                                    {meeting.meetingCode}
                                </Typography>
                                <Chip label="Meeting" size="small" sx={{
                                    background: "rgba(59,130,246,0.12)", color: "#93c5fd",
                                    fontSize: "0.65rem", height: "20px", border: "1px solid rgba(59,130,246,0.2)"
                                }} />
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                                <CalendarTodayIcon sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }} />
                                <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.78rem" }}>
                                    {formatDate(meeting.date)}
                                </Typography>
                            </Box>
                        </Box>

                        {/* Actions */}
                        <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
                            {/* Copy code */}
                            <Tooltip title={copiedId === meeting.meetingCode ? "Copied!" : "Copy code"} placement="top">
                                <IconButton onClick={() => handleCopy(meeting.meetingCode)} size="small" sx={{
                                    color: copiedId === meeting.meetingCode ? "#22c55e" : "rgba(255,255,255,0.4)",
                                    background: "rgba(255,255,255,0.06)", borderRadius: "10px",
                                    "&:hover": { background: "rgba(255,255,255,0.12)", color: "#fff" }
                                }}>
                                    <ContentCopyIcon sx={{ fontSize: "1rem" }} />
                                </IconButton>
                            </Tooltip>

                            {/* NEW: Rejoin button */}
                            <Tooltip title="Rejoin this meeting" placement="top">
                                <IconButton onClick={() => handleRejoin(meeting.meetingCode)} size="small" sx={{
                                    color: "#60a5fa",
                                    background: "rgba(59,130,246,0.12)", borderRadius: "10px",
                                    border: "1px solid rgba(59,130,246,0.2)",
                                    "&:hover": { background: "rgba(59,130,246,0.25)", color: "#93c5fd" }
                                }}>
                                    <ReplayIcon sx={{ fontSize: "1rem" }} />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </CardContent>
                </Card>
            ))}
        </Box>
    );
}
