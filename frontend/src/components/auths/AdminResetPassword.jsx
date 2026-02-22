import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../services/api";
import "./auth-basic.css";

export default function AdminResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const email = new URLSearchParams(useLocation().search).get("email");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/admin/reset-password", {
        email,
        new_password: password,
      });
      navigate("/login");
    } catch {
      setError("Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Reset Password</h1>
        <p className="auth-subtitle">Set your new password.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New Password"
            required
          />
          <input
            className="auth-input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm Password"
            required
          />
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Updating..." : "Reset Password"}
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
