import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./auth-basic.css";
import {
  Activity,
  BrainCircuit,
  Camera,
  ChartColumn,
  CheckCircle2,
  CircleAlert,
  Eye,
  Gauge,
  MessageSquareText,
  Timer,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import "./result-dashboard.css";

export default function Result() {
  const navigate = useNavigate();
  const [answersModal, setAnswersModal] = useState({ open: false, mode: "", answers: [] });

  const result = useMemo(() => {
    try {
      const raw = localStorage.getItem("interview_result");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);
  const sessionResults = useMemo(() => {
    try {
      const raw = localStorage.getItem("session_results");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const normalizedResults = useMemo(() => {
    const out = [];
    if (sessionResults.interview) {
      out.push({ mode: "interview", data: sessionResults.interview });
    }
    if (sessionResults.gd) {
      out.push({ mode: "gd", data: sessionResults.gd });
    }
    if (!out.length && result) {
      out.push({ mode: result.session_mode || result.payload?.session_mode || "interview", data: result });
    }
    return out;
  }, [result, sessionResults]);

  const modeLabel = (mode) => (mode === "gd" ? "Group Discussion" : "Interview");
  const modeIcon = (mode) => (mode === "gd" ? <UsersRound size={18} /> : <BrainCircuit size={18} />);
  const qualityClass = (value) => {
    if (value === "High") return "tone-high";
    if (value === "Medium") return "tone-medium";
    return "tone-low";
  };
  const toPercent = (value, scale = 100) => {
    const v = Number(value);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, (v / scale) * 100));
  };

  if (!normalizedResults.length) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Result</h1>
          <p className="auth-subtitle">No interview result available.</p>
          <button className="auth-btn" onClick={() => navigate("/interview")}>
            Go to Interview
          </button>
        </div>
      </div>
    );
  }

  const renderResultCard = (mode, data) => {
    const summary = data.summary || {};
    const faceMetrics = data.payload?.face_metrics || {};
    const answers = data.payload?.answers || [];
    const timerMinutes = data.timer_minutes ?? "-";
    const forcedByTimer = Boolean(data.forced_by_timer);
    const avgScore10 = Number(summary.average_answer_score ?? 0);
    const scoreBars = [
      { label: "Confidence", value: toPercent(faceMetrics.confidence_score, 100), icon: <Gauge size={15} /> },
      { label: "Nervousness", value: toPercent(faceMetrics.nervousness_score, 100), icon: <Activity size={15} /> },
      { label: "Completion", value: toPercent(summary.completion_rate, 1), icon: <CheckCircle2 size={15} /> },
      { label: "Answer Score", value: toPercent(avgScore10, 10), icon: <ChartColumn size={15} /> },
    ];

    return (
      <div key={`mode-${mode}`} className="result-card-shell">
        <div className="result-mode-head">
          <div className="mode-chip">
            {modeIcon(mode)}
            <span>{modeLabel(mode)}</span>
          </div>
          <div className="session-meta">
            <span><Timer size={14} /> {timerMinutes} min</span>
            <span><CircleAlert size={14} /> {forcedByTimer ? "Auto submitted" : "Manual submit"}</span>
          </div>
        </div>

        <div className="result-summary-grid">
          <article className="summary-box">
            <p className="summary-label">Overall Result</p>
            <h3>{summary.overall_result || "-"}</h3>
            <p className={`tone-pill ${qualityClass(summary.answer_quality)}`}>
              {summary.answer_quality || "Low"} quality
            </p>
          </article>

          <article className="summary-box">
            <p className="summary-label">Session ID</p>
            <h3 className="mono">{data.session_id || "-"}</h3>
            <p className="muted-small">Mode: {mode.toUpperCase()}</p>
          </article>

          <article className="summary-box">
            <p className="summary-label">Signals</p>
            <div className="signal-row">
              <span className={`signal-pill ${qualityClass(summary.confidence_level)}`}>
                <Trophy size={14} /> Confidence: {summary.confidence_level || "-"}
              </span>
              <span className={`signal-pill ${qualityClass(summary.nervousness_level)}`}>
                <Activity size={14} /> Nervousness: {summary.nervousness_level || "-"}
              </span>
            </div>
          </article>
        </div>

        <div className="graph-grid">
          <section className="graph-card">
            <h4><ChartColumn size={16} /> Performance Graph</h4>
            <div className="bars-3d">
              {scoreBars.map((item) => (
                <div key={`${mode}-${item.label}`} className="bar-item">
                  <div className="bar-label">{item.icon} {item.label}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${item.value}%` }} />
                    <div className="bar-shadow" style={{ width: `${item.value}%` }} />
                  </div>
                  <div className="bar-value">{Math.round(item.value)}%</div>
                </div>
              ))}
            </div>
          </section>

          <section className="graph-card">
            <h4><Camera size={16} /> Camera + Voice Details</h4>
            <ul className="metric-list">
              <li><strong>Confidence Score:</strong> {faceMetrics.confidence_score ?? "-"}</li>
              <li><strong>Nervousness Score:</strong> {faceMetrics.nervousness_score ?? "-"}</li>
              <li><strong>Face Visibility Ratio:</strong> {faceMetrics.face_visible_ratio ?? "-"}</li>
              <li><strong>Centered Ratio:</strong> {faceMetrics.centered_ratio ?? "-"}</li>
              <li><strong>Movement Score:</strong> {faceMetrics.movement_score ?? "-"}</li>
              <li><strong>Average Answer Score:</strong> {summary.average_answer_score ?? "-"}</li>
              <li><strong>Completion Rate:</strong> {summary.completion_rate ?? "-"}</li>
            </ul>
          </section>
        </div>

        <section className="graph-card">
          <h4><MessageSquareText size={16} /> Per Question Scores</h4>
          <div className="question-bars">
            {(summary.question_scores || []).map((score, idx) => {
              const normalized = toPercent(score, 10);
              return (
                <div key={`${mode}-qs-${idx}`} className="qbar-row">
                  <span className="qbar-label">Q{idx + 1}</span>
                  <div className="qbar-track">
                    <div className="qbar-fill" style={{ width: `${normalized}%` }} />
                  </div>
                  <span className="qbar-value">{score}</span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="result-actions-row">
          <button
            className="auth-btn icon-btn"
            onClick={() => setAnswersModal({ open: true, mode, answers })}
          >
            <Eye size={16} />
            View Captured Answers
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="auth-page">
      <div className="auth-card interview-card">
        <h1 className="auth-title">
          {normalizedResults.length > 1 ? "Interview + GD Result" : "Session Result"}
        </h1>
        <p className="auth-subtitle">Clear visual report for interview quality, confidence, and completion.</p>
        {normalizedResults.map((entry) => renderResultCard(entry.mode, entry.data))}

        <div className="auth-actions">
          <button className="auth-btn" onClick={() => navigate("/login-success")}>
            Back
          </button>
          <button
            className="auth-btn"
            onClick={() => {
              localStorage.removeItem("interview_result");
              localStorage.removeItem("interview_payload");
              localStorage.removeItem("session_mode");
              localStorage.removeItem("session_timer_minutes");
              localStorage.removeItem("session_results");
              navigate("/login-success");
            }}
          >
            New Session
          </button>
        </div>
      </div>

      {answersModal.open && (
        <div className="answer-modal-overlay">
          <div className="answer-modal-card">
            <div className="answer-modal-head">
              <h3>
                {answersModal.mode === "gd" ? "GD Answers" : "Interview Answers"}
              </h3>
              <button
                type="button"
                className="auth-btn icon-btn"
                onClick={() => setAnswersModal({ open: false, mode: "", answers: [] })}
              >
                <X size={16} />
                Close
              </button>
            </div>

            <div className="answer-scroll">
              {answersModal.answers?.length ? (
                answersModal.answers.map((item, idx) => (
                  <article key={`ans-modal-${idx}`} className="answer-item">
                    <p><strong>Q{idx + 1}.</strong> {item.question || "-"}</p>
                    <p><strong>A:</strong> {item.answer_text || "-"}</p>
                  </article>
                ))
              ) : (
                <p>No captured answers found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
