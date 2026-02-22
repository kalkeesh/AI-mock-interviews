import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import "./auth-basic.css";

export default function LoginSuccess() {
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState("");
  const [analyzeResult, setAnalyzeResult] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/login");
      return;
    }

    const run = async () => {
      try {
        const res = await api.get("/auth/admin/protected", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessage(res.data?.message || "Login successful");
      } catch {
        setError("Session invalid or expired.");
      } finally {
        setCheckingAuth(false);
      }
    };

    run();
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_email");
    navigate("/login");
  };

  const handleAnalyzeResume = async () => {
    if (!resumeFile) {
      setError("Please choose a PDF or DOCX resume file.");
      return;
    }

    setError("");
    setAnalyzeResult(null);
    setAnalyzing(true);

    const steps = [
      "Uploading resume...",
      "Parsing resume...",
      "Generating interview questions...",
      "Finalizing result...",
    ];

    let idx = 0;
    setAnalyzeStep(steps[idx]);
    const timer = setInterval(() => {
      idx += 1;
      if (idx < steps.length) {
        setAnalyzeStep(steps[idx]);
      }
    }, 900);

    try {
      const formData = new FormData();
      formData.append("file", resumeFile);
      const res = await api.upload("/analyze-resume/", formData);
      setAnalyzeResult(res.data);
      localStorage.setItem("interview_payload", JSON.stringify(res.data));
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Resume analysis failed.");
    } finally {
      clearInterval(timer);
      setAnalyzing(false);
      setAnalyzeStep("");
    }
  };

  const startInterview = () => {
    navigate("/interview");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Resume Analysis</h1>
        <p className="auth-subtitle">Upload resume and prepare interview questions.</p>

        {checkingAuth && <p>Validating session...</p>}
        {!checkingAuth && !error && <p>{message}</p>}

        {!checkingAuth && (
          <div className="auth-form">
            <input
              className="auth-input"
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            />

            <button className="auth-btn" onClick={handleAnalyzeResume} disabled={analyzing}>
              {analyzing ? "Analyzing..." : "Upload & Analyze Resume"}
            </button>

            {analyzing && (
              <div>
                <span className="auth-spinner" /> {analyzeStep}
              </div>
            )}

            {analyzeResult && (
              <div>
                <p>Resume analyzed successfully.</p>
                <button className="auth-btn" onClick={startInterview}>
                  Start Interview
                </button>
              </div>
            )}
          </div>
        )}

        {!checkingAuth && error && <div className="auth-error">{error}</div>}

        <div className="auth-actions">
          <button className="auth-btn" onClick={() => navigate("/login")}>
            Back to Login
          </button>
          <button className="auth-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
