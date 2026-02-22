import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../services/api";
import "./auth-basic.css";

export default function AdminForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const emailParam = new URLSearchParams(location.search).get("email");
    if (emailParam) setEmail(emailParam);
  }, [location]);

  const handleContinue = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/admin/forgot-password", { email });
      navigate(`/admin/verify-otp?email=${encodeURIComponent(email)}`);
    } catch {
      setError("Unable to send OTP. Please check email and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Forgot Password</h1>
        <p className="auth-subtitle">Enter your admin email to receive OTP.</p>
        <form className="auth-form" onSubmit={handleContinue}>
          <input
            className="auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin Email"
            required
          />
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </form>
        <div className="auth-note">
          <button className="auth-btn" onClick={() => navigate("/login")}>
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
