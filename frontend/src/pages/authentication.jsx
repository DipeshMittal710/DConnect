import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Typography from '@mui/material/Typography';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { AuthContext } from '../contexts/AuthContext';
import { Snackbar } from '@mui/material';

// ── dark theme matching the VideoMeet app ─────────────────────────────────
const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary:    { main: '#3b82f6' },
        secondary:  { main: '#8b5cf6' },
        background: { default: 'rgb(1, 4, 48)', paper: 'rgba(255,255,255,0.04)' },
    },
    typography: {
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    shape: { borderRadius: 10 },
});

// shared sx for all text fields
const fieldSx = {
    '& .MuiOutlinedInput-root': {
        color: '#fff',
        borderRadius: '10px',
        '& fieldset':            { borderColor: 'rgba(255,255,255,0.14)' },
        '&:hover fieldset':      { borderColor: 'rgba(255,255,255,0.3)'  },
        '&.Mui-focused fieldset':{ borderColor: '#3b82f6'                },
    },
    '& .MuiInputLabel-root':           { color: 'rgba(255,255,255,0.42)' },
    '& .MuiInputLabel-root.Mui-focused':{ color: '#3b82f6'               },
};

export default function Authentication() {

    const [username,  setUsername]  = React.useState();
    const [password,  setPassword]  = React.useState();
    const [name,      setName]      = React.useState();
    const [error,     setError]     = React.useState();
    const [message,   setMessage]   = React.useState();
    const [formState, setFormState] = React.useState(0);
    const [open,      setOpen]      = React.useState(false);

    const { handleRegister, handleLogin } = React.useContext(AuthContext);

    let handleAuth = async () => {
        try {
            if (formState === 0) {
                let result = await handleLogin(username, password);
            }
            if (formState === 1) {
                let result = await handleRegister(name, username, password);
                console.log(result);
                setUsername("");
                setMessage(result);
                setOpen(true);
                setError("");
                setFormState(0);
                setPassword("");
            }
        } catch (err) {
            console.log(err);
            let message = (err.response.data.message);
            setError(message);
        }
    };

    // sx for the toggle button (active vs inactive)
    const toggleBtnSx = (active) => ({
        borderRadius: '9px',
        py: 0.85,
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.875rem',
        transition: 'all 0.2s',
        ...(active ? {
            background: '#3b82f6',
            color: '#fff',
            boxShadow: '0 2px 10px rgba(59,130,246,0.4)',
            '&:hover': { background: '#2563eb' },
        } : {
            color: 'rgba(255,255,255,0.45)',
            '&:hover': { background: 'rgba(255,255,255,0.07)', color: '#fff' },
        }),
    });

    const features = [
        { icon: '🎥', text: 'Crystal-clear HD video & audio'      },
        { icon: '💬', text: 'Real-time in-call chat & reactions'   },
        { icon: '🖥️', text: 'One-click screen sharing'            },
        { icon: '🔒', text: 'Secure, end-to-end encrypted calls'   },
    ];

    return (
        <ThemeProvider theme={darkTheme}>
            <Grid container component="main" sx={{ height: '100vh' }}>
                <CssBaseline />

                {/* ── LEFT PANEL — branding ─────────────────────────────────── */}
                <Grid
                    item xs={false} sm={4} md={7}
                    sx={{
                        background: 'linear-gradient(135deg, rgb(1,4,48) 0%, rgb(6,14,65) 55%, rgb(2,7,52) 100%)',
                        display: { xs: 'none', sm: 'flex' },
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    {/* decorative glow circles */}
                    <Box sx={{
                        position: 'absolute', width: 560, height: 560,
                        borderRadius: '50%', top: -140, right: -140,
                        background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
                        border: '1px solid rgba(59,130,246,0.09)',
                        pointerEvents: 'none',
                    }} />
                    <Box sx={{
                        position: 'absolute', width: 380, height: 380,
                        borderRadius: '50%', bottom: -100, left: -100,
                        background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)',
                        border: '1px solid rgba(139,92,246,0.07)',
                        pointerEvents: 'none',
                    }} />

                    {/* content */}
                    <Box sx={{ position: 'relative', textAlign: 'left', px: 7, maxWidth: 480 }}>
                        <Typography variant="h3" sx={{
                            color: '#fff', fontWeight: 700, mb: 1,
                            letterSpacing: '-0.5px',
                        }}>
                            DConnect
                        </Typography>
                        <Typography sx={{
                            color: 'rgba(255,255,255,0.4)', fontSize: '1.05rem', mb: 5,
                        }}>
                            HD video calls, right in your browser
                        </Typography>

                        {features.map((f) => (
                            <Box key={f.text} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
                                <Box sx={{
                                    width: 42, height: 42, borderRadius: '11px', flexShrink: 0,
                                    background: 'rgba(59,130,246,0.1)',
                                    border: '1px solid rgba(59,130,246,0.18)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.1rem',
                                }}>
                                    {f.icon}
                                </Box>
                                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                                    {f.text}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Grid>

                {/* ── RIGHT PANEL — form ────────────────────────────────────── */}
                <Grid
                    item xs={12} sm={8} md={5}
                    sx={{
                        background: 'rgb(1, 4, 48)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Box sx={{
                        width: '100%',
                        maxWidth: 400,
                        mx: 4,
                        p: 4,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        borderRadius: '20px',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                    }}>

                        {/* avatar kept from original */}
                        <Avatar sx={{
                            mb: 2.5,
                            width: 44, height: 44,
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
                        }}>
                            <LockOutlinedIcon sx={{ fontSize: '1.1rem' }} />
                        </Avatar>

                        {/* heading changes per mode */}
                        <Typography variant="h5" sx={{
                            color: '#fff', fontWeight: 700, mb: 0.5, letterSpacing: '-0.2px',
                        }}>
                            {formState === 0 ? 'Welcome back' : 'Create account'}
                        </Typography>
                        <Typography sx={{
                            color: 'rgba(255,255,255,0.38)', fontSize: '0.875rem', mb: 3,
                        }}>
                            {formState === 0 ? 'Sign in to continue to VideoMeet' : 'Join VideoMeet today'}
                        </Typography>

                        {/* ── Sign In / Sign Up pill toggle ───────────────── */}
                        <Box sx={{
                            display: 'flex', p: '4px',
                            background: 'rgba(255,255,255,0.06)',
                            borderRadius: '12px', mb: 3,
                            border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                            <Button fullWidth onClick={() => { setFormState(0) }} sx={toggleBtnSx(formState === 0)}>
                                Sign In
                            </Button>
                            <Button fullWidth onClick={() => { setFormState(1) }} sx={toggleBtnSx(formState === 1)}>
                                Sign Up
                            </Button>
                        </Box>

                        {/* ── Form fields ────────────────────────────────── */}
                        <Box component="form" noValidate sx={{ mt: 0 }}>

                            {formState === 1 ? (
                                <TextField
                                    margin="normal"
                                    required
                                    fullWidth
                                    id="username"
                                    label="Full Name"
                                    name="username"
                                    value={name}
                                    autoFocus
                                    onChange={(e) => setName(e.target.value)}
                                    sx={fieldSx}
                                />
                            ) : <></>}

                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="username"
                                label="Username"
                                name="username"
                                value={username}
                                autoFocus
                                onChange={(e) => setUsername(e.target.value)}
                                sx={fieldSx}
                            />

                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                name="password"
                                label="Password"
                                value={password}
                                type="password"
                                onChange={(e) => setPassword(e.target.value)}
                                id="password"
                                sx={fieldSx}
                            />

                            {/* error message — styled box instead of bare <p> */}
                            {error ? (
                                <Box sx={{
                                    mt: 1.5, px: 2, py: 1,
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.28)',
                                    borderRadius: '8px',
                                }}>
                                    <Typography sx={{ color: '#fca5a5', fontSize: '0.8rem' }}>
                                        {error}
                                    </Typography>
                                </Box>
                            ) : (
                                /* keep same DOM shape as original <p> so layout doesn't shift */
                                <p style={{ color: 'red', margin: 0 }}></p>
                            )}

                            <Button
                                type="button"
                                fullWidth
                                variant="contained"
                                sx={{
                                    mt: 3, mb: 2, py: 1.45,
                                    background: '#3b82f6',
                                    '&:hover': { background: '#2563eb' },
                                    borderRadius: '10px',
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    letterSpacing: 0,
                                    boxShadow: '0 4px 18px rgba(59,130,246,0.35)',
                                }}
                                onClick={handleAuth}
                            >
                                {formState === 0 ? 'Sign In' : 'Create Account'}
                            </Button>

                        </Box>
                    </Box>
                </Grid>

            </Grid>

            <Snackbar
                open={open}
                autoHideDuration={4000}
                message={message}
            />

        </ThemeProvider>
    );
}