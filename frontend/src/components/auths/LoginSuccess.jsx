import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import {
  BrainCircuit,
  FileUp,
  LogOut,
  Sparkles,
  Timer,
  UserRound,
  UsersRound,
  UserPlus,
} from "lucide-react";
import api from "../../services/api";
import loadingAi from "../../assets/lottie/loading-ai.json";
import uploadCloud from "../../assets/lottie/upload-cloud.json";
import "./login-success-home.css";

export default function LoginSuccess() {
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState("");
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [selectedTimer, setSelectedTimer] = useState("5");
  const [adminName, setAdminName] = useState("");
  const [helloMessage, setHelloMessage] = useState("Welcome to your AI interview studio.");

  const adminEmail = useMemo(() => localStorage.getItem("admin_email") || "", []);
  const displayName = useMemo(
    () => adminName || adminEmail.split("@")[0] || "Administrator",
    [adminName, adminEmail]
  );

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/login");
      return;
    }

    const run = async () => {
      try {
        const [detailsRes, protectedRes] = await Promise.all([
          api.get("/auth/admin/details", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          api.get("/auth/admin/protected", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const fullName = [
          detailsRes?.data?.first_name,
          detailsRes?.data?.last_name,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
        setAdminName(fullName);
        setHelloMessage(protectedRes?.data?.message || "Login successful");
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
    localStorage.removeItem("session_mode");
    localStorage.removeItem("session_timer_minutes");
    localStorage.removeItem("session_results");
    localStorage.removeItem("interview_result");
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
      "Uploading resume",
      "Parsing and extracting structured profile",
      "Generating interview + GD prompts",
      "Finalizing your session data",
    ];

    let idx = 0;
    setAnalyzeStep(steps[idx]);
    const timer = setInterval(() => {
      idx += 1;
      if (idx < steps.length) {
        setAnalyzeStep(steps[idx]);
      }
    }, 1100);

    try {
      const formData = new FormData();
      formData.append("file", resumeFile);
      const res = await api.upload("/analyze-resume/", formData);
      setAnalyzeResult(res.data);
      localStorage.setItem("interview_payload", JSON.stringify(res.data));
      localStorage.removeItem("session_results");
      localStorage.removeItem("interview_result");
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
    localStorage.setItem("session_mode", "interview");
    localStorage.setItem("session_timer_minutes", selectedTimer);
    navigate("/interview");
  };

  const startGroupDiscussion = () => {
    localStorage.setItem("session_mode", "gd");
    localStorage.setItem("session_timer_minutes", selectedTimer);
    navigate("/interview");
  };

  if (checkingAuth) {
    return (
      <div className="home-loading">
        <div className="loading-panel">
          <Lottie animationData={loadingAi} loop style={{ width: 140, height: 140 }} />
          <h2>Validating Session</h2>
          <p>Preparing your interview workspace.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="success-home">
      <header className="home-navbar">
        <div className="home-user">
          <span className="user-chip-icon">
            <UserRound size={16} />
          </span>
          <div>
            <p className="user-name">{displayName}</p>
            <p className="user-meta">{adminEmail || "admin@aimock.local"}</p>
          </div>
        </div>

        <div className="home-nav-actions">
          <button type="button" className="nav-btn register" onClick={() => navigate("/admin/register")}>
            <UserPlus size={16} />
            Register Admin
          </button>
          <button type="button" className="nav-btn logout" onClick={logout}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      <main className="home-main">
        <section className="hero">
          <p className="hero-badge">
            <Sparkles size={14} />
            AI Mock Interviews Platform
          </p>
          <h1>Build interview confidence with live AI-guided sessions.</h1>
          <p className="hero-copy">
            Upload a resume once, then launch structured technical interviews and focused
            group discussion sessions with timer-based evaluation.
          </p>
          <p className="hello-line">{helloMessage}</p>
        </section>

        <section className="info-grid">
          <article className="info-card">
            <div className="icon-wrap interview">
              <BrainCircuit size={22} />
            </div>
            <h3>AI Interview Sessions</h3>
            <p>
              Candidate answers are captured by voice, scored by semantic quality,
              and combined with confidence/nervousness metrics.
            </p>
          </article>

          <article className="info-card">
            <div className="icon-wrap gd">
              <UsersRound size={22} />
            </div>
            <h3>AI GD Sessions</h3>
            <p>
              Practice group-discussion style speaking with timed prompts and
              performance feedback for communication improvement.
            </p>
          </article>
        </section>

        <section className="workspace-card">
          <div className="workspace-head">
            <h2>Create Candidate Session</h2>
            <p>Upload a PDF or DOCX resume to generate interview and GD content.</p>
          </div>

          <label className="upload-box" htmlFor="resume-upload">
            <div className="upload-lottie">
              <Lottie animationData={uploadCloud} loop style={{ width: 84, height: 84 }} />
            </div>
            <div>
              <p className="upload-title">Drop resume or click to browse</p>
              <p className="upload-subtitle">Supported formats: PDF, DOCX</p>
              <p className="upload-file-name">{resumeFile ? resumeFile.name : "No file selected"}</p>
            </div>
            <FileUp size={20} />
            <input
              id="resume-upload"
              className="hidden-input"
              type="file"
              accept=".pdf,.docx"
              onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
            />
          </label>

          <button
            type="button"
            className="analyze-btn"
            onClick={handleAnalyzeResume}
            disabled={analyzing}
          >
            {analyzing ? "Analyzing Resume..." : "Generate Interview + GD Plan"}
          </button>

          {analyzing && (
            <div className="analyze-state">
              <Lottie animationData={loadingAi} loop style={{ width: 76, height: 76 }} />
              <p>{analyzeStep}</p>
            </div>
          )}

          {error && <div className="home-error">{error}</div>}

          {analyzeResult && (
            <div className="session-actions">
              <div className="timer-wrap">
                <p className="timer-label">
                  <Timer size={16} />
                  Session Timer
                </p>
                <div className="timer-chips">
                  {["5", "7", "9"].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`timer-chip ${selectedTimer === value ? "active" : ""}`}
                      onClick={() => setSelectedTimer(value)}
                    >
                      {value} min
                    </button>
                  ))}
                </div>
              </div>

              <div className="start-actions">
                <button type="button" className="start-btn interview" onClick={startInterview}>
                  Start Interview
                </button>
                <button type="button" className="start-btn gd" onClick={startGroupDiscussion}>
                  Start GD
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
