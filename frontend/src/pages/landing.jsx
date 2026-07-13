import React from "react";
import "../App.css";
import { Link, useNavigate } from "react-router-dom";

export default function LandingPage() {
  const router = useNavigate();

  return (
    <div className="landingPageContainer">
      <nav>
        <div className="navHeader">
          <h2>DConnect</h2>
        </div>

        <div className="navlist">
          {/* UPDATED: navigate to /guest instead of a random room code directly.
              The GuestPage lets them choose create or join and enter their name. */}
          <p onClick={() => router("/guest")}>Join as Guest</p>
          <p onClick={() => router("/auth")}>Register</p>
          <div onClick={() => router("/auth")} role="button">
            <p>Login</p>
          </div>
        </div>
      </nav>

      <div className="landingMainContainer">
        <div>
          <h1>
            <span style={{ color: "#FF9839" }}>Connect</span> with your loved
            Ones
          </h1>

          <p>Cover a distance by DConnect</p>

          <div role="button">
            <Link to="/auth">Get Started</Link>
          </div>
        </div>

        <div className="landingImageContainer">
          <img src="/mobile.png" alt="mobile" />
        </div>
      </div>
    </div>
  );
}
