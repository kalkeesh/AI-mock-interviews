import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./auth-basic.css";

export default function Result() {
  const navigate = useNavigate();

  const result = useMemo(() => {
    try {
      const raw = localStorage.getItem("interview_result");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  if (!result) {
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

  const summary = result.summary || {};
  const faceMetrics = result.payload?.face_metrics || {};
  const answers = result.payload?.answers || [];

  return (
    <div className="auth-page">
      <div className="auth-card interview-card">
        <h1 className="auth-title">Interview Result</h1>
        <p className="auth-subtitle">Session ID: {result.session_id}</p>

        <h3>Overall Analysis</h3>
        <p><strong>Overall Result:</strong> {summary.overall_result || "-"}</p>
        <p><strong>Answer Quality:</strong> {summary.answer_quality || "-"}</p>
        <p><strong>Average Answer Score (0-10):</strong> {summary.average_answer_score ?? "-"}</p>
        <p><strong>Confidence:</strong> {summary.confidence_level || "-"}</p>
        <p><strong>Nervousness:</strong> {summary.nervousness_level || "-"}</p>
        <p><strong>Completion Rate:</strong> {summary.completion_rate ?? "-"}</p>

        <h3>Per Question Score (0-10)</h3>
        <ol>
          {(summary.question_scores || []).map((score, idx) => (
            <li key={`qs-${idx}`}>Q{idx + 1}: {score}</li>
          ))}
        </ol>

        <h3>Camera + Voice Metrics</h3>
        <p><strong>Confidence Score:</strong> {faceMetrics.confidence_score ?? "-"}</p>
        <p><strong>Nervousness Score:</strong> {faceMetrics.nervousness_score ?? "-"}</p>
        <p><strong>Face Visibility Ratio:</strong> {faceMetrics.face_visible_ratio ?? "-"}</p>
        <p><strong>Centered Ratio:</strong> {faceMetrics.centered_ratio ?? "-"}</p>
        <p><strong>Movement Score:</strong> {faceMetrics.movement_score ?? "-"}</p>

        <h3>Captured Answers</h3>
        <ol>
          {answers.map((item, idx) => (
            <li key={`ans-${idx}`}>
              <p><strong>Q:</strong> {item.question}</p>
              <p><strong>A:</strong> {item.answer_text || "-"}</p>
            </li>
          ))}
        </ol>

        <div className="auth-actions">
          <button className="auth-btn" onClick={() => navigate("/login-success")}>
            Back
          </button>
          <button
            className="auth-btn"
            onClick={() => {
              localStorage.removeItem("interview_result");
              localStorage.removeItem("interview_payload");
              navigate("/login-success");
            }}
          >
            New Session
          </button>
        </div>
      </div>
    </div>
  );
}
