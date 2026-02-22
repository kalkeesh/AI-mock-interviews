import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../services/api";
import "./auth-basic.css";

export default function AdminOtpVerification() {
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const emailParam = new URLSearchParams(location.search).get("email");
    if (emailParam) setEmail(emailParam);
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/admin/verify-otp", { email, otp });
      navigate(`/admin/reset-password?email=${encodeURIComponent(email)}`);
    } catch {
      setError("Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Verify OTP</h1>
        <p className="auth-subtitle">Enter the OTP sent to your email.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="auth-input"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="One-Time Password"
            required
          />
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </form>
        <div className="auth-note">
          <button
            className="auth-btn"
            onClick={() => navigate(`/admin/forgot-password?email=${encodeURIComponent(email)}`)}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
