import { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom"
import { AuthContext } from "../contexts/AuthContext";

const withAuth = (WrappedComponent) => {
    const AuthComponent = (props) => {
        const router = useNavigate();

        // NEW: read authChecked from context so we wait for the auto-login
        // check to finish before deciding whether to redirect
        const { authChecked } = useContext(AuthContext);

        const isAuthenticated = () => {
            return !!localStorage.getItem("token");
        }

        useEffect(() => {
            // Only run the redirect check once the context has finished
            // verifying the stored token with the server.
            // Without this, the page would flash /auth briefly for users
            // who are already logged in.
            if (!authChecked) return;

            if (!isAuthenticated()) {
                router("/auth");
            }
        }, [authChecked])

        // NEW: while the token verification is still in progress, show a
        // minimal dark loading screen that matches the app theme.
        // This prevents the page content from flashing before the check.
        if (!authChecked) {
            return (
                <div style={{
                    height: "100vh",
                    background: "rgb(1, 4, 48)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: "16px",
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                }}>
                    <div style={{
                        width: "40px", height: "40px",
                        border: "3px solid rgba(255,255,255,0.1)",
                        borderTop: "3px solid #3b82f6",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite"
                    }}></div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.875rem", margin: 0 }}>
                        Loading...
                    </p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            );
        }

        return <WrappedComponent {...props} />
    }

    return AuthComponent;
}

export default withAuth;