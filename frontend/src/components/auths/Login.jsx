import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import "./auth-basic.css";

export default function Login() {
  const navigate = useNavigate();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdminLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/admin/login", {
        email: adminEmail,
        password: adminPassword,
      });
      localStorage.setItem("admin_token", res.data.token);
      localStorage.setItem("admin_email", adminEmail);
      navigate("/login-success");
    } catch {
      setError("Invalid admin credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Admin Login</h1>
        <p className="auth-subtitle">Sign in to continue.</p>

        <div className="auth-form">
          <input
            className="auth-input"
            type="email"
            required
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="Admin Email"
          />
          <input
            className="auth-input"
            type={showPassword ? "text" : "password"}
            required
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Password"
          />
          <div className="auth-actions">
            <label>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />{" "}
              Show password
            </label>
            <button
              className="auth-btn"
              onClick={() =>
                navigate(`/admin/forgot-password?email=${encodeURIComponent(adminEmail)}`)
              }
            >
              Forgot password
            </button>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-btn" onClick={handleAdminLogin} disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </div>

        <div className="auth-note">
          <button className="auth-btn" onClick={() => navigate("/admin/register")}>
            Create Admin Account
          </button>
        </div>
      </div>
    </div>
  );
}
