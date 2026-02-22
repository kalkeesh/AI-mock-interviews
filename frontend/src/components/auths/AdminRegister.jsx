import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import "./auth-basic.css";

export default function AdminRegister() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    profession: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      await api.post("/auth/admin/register", form);
      navigate("/login");
    } catch (err) {
      setError(err?.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Admin Registration</h1>
        <p className="auth-subtitle">Create a new admin account.</p>

        <form className="auth-form" onSubmit={handleRegister}>
          <div className="auth-row">
            <input
              className="auth-input"
              type="text"
              placeholder="First Name"
              value={form.first_name}
              onChange={(e) => handleChange("first_name", e.target.value)}
              required
            />
            <input
              className="auth-input"
              type="text"
              placeholder="Last Name"
              value={form.last_name}
              onChange={(e) => handleChange("last_name", e.target.value)}
              required
            />
          </div>
          <input
            className="auth-input"
            type="text"
            placeholder="Profession"
            value={form.profession}
            onChange={(e) => handleChange("profession", e.target.value)}
            required
          />
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            required
          />
          <div className="auth-row">
            <input
              className="auth-input"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              required
            />
            <input
              className="auth-input"
              type="password"
              placeholder="Confirm Password"
              value={form.confirm_password}
              onChange={(e) => handleChange("confirm_password", e.target.value)}
              required
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Register"}
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
