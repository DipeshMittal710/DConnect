import axios from "axios";
import httpStatus from "http-status";
import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import server from "../environment";


export const AuthContext = createContext({});

const client = axios.create({
    baseURL: `${server}/api/v1/users`
})


export const AuthProvider = ({ children }) => {

    const authContext = useContext(AuthContext);

    const [userData, setUserData] = useState(authContext);

    // NEW: tracks whether we've finished the auto-login check so the UI
    // doesn't flash the login page before redirecting already-logged-in users
    const [authChecked, setAuthChecked] = useState(false);

    const router = useNavigate();

    // NEW: on every app load, if a token exists in localStorage we ask the
    // server whether it's still valid. If yes → go straight to /home.
    // If no → clear the stale token so the login form shows cleanly.
    useEffect(() => {
        const checkStoredToken = async () => {
            const token = localStorage.getItem("token");

            if (!token) {
                // no stored token — nothing to check, show login normally
                setAuthChecked(true);
                return;
            }

            try {
                const request = await client.get("/verify_token", {
                    params: { token }
                });

                if (request.data.success) {
                    // token is still valid — skip the login screen
                    router("/home");
                } else {
                    // token expired or invalid — remove it
                    localStorage.removeItem("token");
                }
            } catch (err) {
                // server error or 401 — remove stale token
                localStorage.removeItem("token");
            } finally {
                setAuthChecked(true);
            }
        };

        checkStoredToken();
    }, []);


    const handleRegister = async (name, username, password) => {
        try {
            let request = await client.post("/register", {
                name: name,
                username: username,
                password: password
            })

            if (request.status === httpStatus.CREATED) {
                return request.data.message;
            }
        } catch (err) {
            throw err;
        }
    }

    const handleLogin = async (username, password) => {
        try {
            let request = await client.post("/login", {
                username: username,
                password: password
            });

            console.log(username, password)
            console.log(request.data)

            if (request.status === httpStatus.OK) {
                localStorage.setItem("token", request.data.token);
                router("/home")
            }
        } catch (err) {
            throw err;
        }
    }

    const getHistoryOfUser = async () => {
        try {
            let request = await client.get("/get_all_activity", {
                params: {
                    token: localStorage.getItem("token")
                }
            });
            return request.data
        } catch (err) {
            throw err;
        }
    }

    const addToUserHistory = async (meetingCode) => {
        try {
            let request = await client.post("/add_to_activity", {
                token: localStorage.getItem("token"),
                meeting_code: meetingCode
            });
            return request
        } catch (e) {
            throw e;
        }
    }


    const data = {
        userData, setUserData,
        addToUserHistory, getHistoryOfUser,
        handleRegister, handleLogin,
        authChecked  // NEW: exposed so withAuth can wait for the check to finish
    }

    return (
        <AuthContext.Provider value={data}>
            {children}
        </AuthContext.Provider>
    )

}