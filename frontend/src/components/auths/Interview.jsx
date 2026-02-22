import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import "./auth-basic.css";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toLevel(score) {
  if (score < 34) return "Low";
  if (score < 67) return "Medium";
  return "High";
}

function normalizeQuestion(category, item) {
  if (typeof item === "string") {
    return { category, topic: null, question: item, expected_answer: item };
  }

  if (item && typeof item === "object") {
    const text =
      item.question ||
      item.text ||
      item.prompt ||
      item.title ||
      JSON.stringify(item);
    const expected = item.expected_answer || item.expected || text;
    return {
      category,
      topic: item.topic || item.subtopic || null,
      question: String(text),
      expected_answer: String(expected),
    };
  }

  return {
    category,
    topic: null,
    question: String(item ?? ""),
    expected_answer: String(item ?? ""),
  };
}

export default function Interview() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const micStreamRef = useRef(null);
  const recognitionRef = useRef(null);
  const detectorRef = useRef(null);
  const detectorTimerRef = useRef(null);
  const analysisCanvasRef = useRef(null);
  const prevFrameRef = useRef(null);
  const askedAtRef = useRef({});

  const [sessionStarted, setSessionStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [answers, setAnswers] = useState([]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("Camera not started.");
  const [micReady, setMicReady] = useState(false);
  const [micMessage, setMicMessage] = useState("Mic not started.");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const metricsRef = useRef({
    samples: 0,
    faceVisible: 0,
    centered: 0,
    movementScoreTotal: 0,
    lastCenter: null,
    totalWords: 0,
    fillerWords: 0,
  });

  const interviewData = useMemo(() => {
    try {
      const raw = localStorage.getItem("interview_payload");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const extracted = interviewData?.data?.extracted_information || {};
  const questions = useMemo(() => {
    const q = interviewData?.data?.interview_questions || {};
    return [
      ...(q.technical || []).map((item) => normalizeQuestion("technical", item)),
      ...(q.hr || []).map((item) => normalizeQuestion("hr", item)),
      ...(q.behavioral || []).map((item) => normalizeQuestion("behavioral", item)),
    ];
  }, [interviewData]);

  useEffect(() => {
    if (!interviewData) {
      navigate("/login-success");
    }
  }, [interviewData, navigate]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const segment = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) {
          finalText += `${segment} `;
        } else {
          interimText += `${segment} `;
        }
      }
      setCurrentAnswer(`${finalText}${interimText}`.trim());
    };
    recognition.onstart = () => {
      setListening(true);
      setMicMessage("Listening and converting speech to text...");
    };
    recognition.onerror = (e) => {
      setListening(false);
      setMicMessage(`Mic error: ${e.error || "unknown"}`);
      setError(`Speech recognition failed: ${e.error || "unknown error"}`);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      stopListening();
      stopCamera();
      stopMic();
    };
  }, []);

  useEffect(() => {
    if (!sessionStarted || currentIndex >= questions.length) return;
    askQuestionByVoice(questions[currentIndex].question);
  }, [sessionStarted, currentIndex, questions]);

  const askQuestionByVoice = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    askedAtRef.current[currentIndex] = new Date().toISOString();
  };

  const startListening = async () => {
    if (!recognitionRef.current) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }
    setError("");
    if (!micReady) {
      const ok = await startMic();
      if (!ok) return;
    }
    try {
      recognitionRef.current.start();
    } catch (err) {
      setError(`Unable to start voice recognition: ${err?.message || "unknown error"}`);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setListening(false);
    setMicMessage("Mic idle");
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      setMicReady(true);
      setMicMessage("Mic permission granted.");
      return true;
    } catch (err) {
      setMicReady(false);
      setMicMessage("Mic unavailable. Please allow microphone permission.");
      setError(err?.message || "Unable to access microphone.");
      return false;
    }
  };

  const stopMic = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    setMicReady(false);
    setMicMessage("Mic stopped.");
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 360 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => resolve();
        });
        await videoRef.current.play();
        if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
          throw new Error("Camera stream connected but no video frames detected.");
        }
      }
      setCameraReady(true);
      setCameraMessage("Webcam active and previewing.");

      if ("FaceDetector" in window) {
        detectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      } else {
        detectorRef.current = null;
        setCameraMessage("Webcam active (compatibility mode).");
      }

      detectorTimerRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;

        const video = videoRef.current;
        const m = metricsRef.current;
        m.samples += 1;

        if (!detectorRef.current) {
          // Browser-agnostic fallback: estimate presence/stability from video frames.
          if (!analysisCanvasRef.current) {
            analysisCanvasRef.current = document.createElement("canvas");
          }
          const canvas = analysisCanvasRef.current;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;

          const w = 96;
          const h = 54;
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          const frame = ctx.getImageData(0, 0, w, h).data;

          let luminanceSum = 0;
          const currentGray = new Uint8Array(w * h);
          for (let i = 0, p = 0; i < frame.length; i += 4, p += 1) {
            const gray = (frame[i] * 0.299 + frame[i + 1] * 0.587 + frame[i + 2] * 0.114) | 0;
            currentGray[p] = gray;
            luminanceSum += gray;
          }

          const avgLuma = luminanceSum / (w * h);
          if (avgLuma > 12) {
            m.faceVisible += 1;
          }

          // Assume candidate attempts to stay centered in compatibility mode.
          if (avgLuma > 12) {
            m.centered += 1;
          }

          if (prevFrameRef.current) {
            let diff = 0;
            for (let i = 0; i < currentGray.length; i += 1) {
              diff += Math.abs(currentGray[i] - prevFrameRef.current[i]);
            }
            const normalizedDiff = diff / (currentGray.length * 255);
            m.movementScoreTotal += clamp(normalizedDiff * 4, 0, 1);
          }
          prevFrameRef.current = currentGray;
          return;
        }

        try {
          const faces = await detectorRef.current.detect(video);
          if (!faces.length) return;

          m.faceVisible += 1;
          const box = faces[0].boundingBox;
          const faceCenterX = box.x + box.width / 2;
          const faceCenterY = box.y + box.height / 2;
          const dx = (faceCenterX - video.videoWidth / 2) / (video.videoWidth / 2);
          const dy = (faceCenterY - video.videoHeight / 2) / (video.videoHeight / 2);
          const centerDist = Math.sqrt(dx * dx + dy * dy);
          if (centerDist < 0.35) {
            m.centered += 1;
          }

          const currentCenter = { x: faceCenterX, y: faceCenterY };
          if (m.lastCenter) {
            const moveX = (currentCenter.x - m.lastCenter.x) / Math.max(video.videoWidth, 1);
            const moveY = (currentCenter.y - m.lastCenter.y) / Math.max(video.videoHeight, 1);
            const movement = clamp(Math.sqrt(moveX * moveX + moveY * moveY) * 2.5, 0, 1);
            m.movementScoreTotal += movement;
          }
          m.lastCenter = currentCenter;
        } catch {
          // Ignore single frame detector failures.
        }
      }, 1000);
      return true;
    } catch (err) {
      const msg = err?.message || "Unable to access webcam.";
      setError(msg);
      setCameraMessage("Webcam unavailable. Check browser camera permission.");
      return false;
    }
  };

  const stopCamera = () => {
    if (detectorTimerRef.current) {
      clearInterval(detectorTimerRef.current);
      detectorTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setCameraMessage("Camera stopped.");
  };

  const startSession = async () => {
    setError("");
    const ok = await startCamera();
    if (!ok) return;
    await startMic();
    setSessionStarted(true);
  };

  const saveCurrentAnswer = () => {
    const questionItem = questions[currentIndex];
    const answerText = currentAnswer.trim();
    const answeredAt = new Date().toISOString();
    const askedAt = askedAtRef.current[currentIndex] || answeredAt;
    const durationSeconds =
      (new Date(answeredAt).getTime() - new Date(askedAt).getTime()) / 1000;

    const words = answerText ? answerText.split(/\s+/).filter(Boolean) : [];
    const fillerMatches = answerText.match(/\b(um|uh|like|hmm|you know)\b/gi) || [];
    metricsRef.current.totalWords += words.length;
    metricsRef.current.fillerWords += fillerMatches.length;

    const nextAnswers = [...answers];
    nextAnswers[currentIndex] = {
      question: questionItem.question,
      category: questionItem.category,
      expected_answer: questionItem.expected_answer || questionItem.question,
      answer_text: answerText,
      asked_at: askedAt,
      answered_at: answeredAt,
      duration_seconds: Number(durationSeconds.toFixed(2)),
    };
    setAnswers(nextAnswers);
    return nextAnswers;
  };

  const nextQuestion = () => {
    const nextAnswers = saveCurrentAnswer();
    setCurrentAnswer("");
    stopListening();

    if (currentIndex >= questions.length - 1) {
      finishInterview(nextAnswers);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const finishInterview = async (finalAnswers) => {
    setSaving(true);
    window.speechSynthesis.cancel();
    stopListening();
    stopCamera();
    stopMic();

    const m = metricsRef.current;
    const samples = Math.max(m.samples, 1);
    const faceVisibleRatio = m.faceVisible / samples;
    const centeredRatio = m.centered / samples;
    const movementScore = m.movementScoreTotal / Math.max(samples - 1, 1);
    const fillerRatio = m.fillerWords / Math.max(m.totalWords, 1);
    const avgWordsPerAnswer =
      finalAnswers.reduce((sum, a) => sum + (a.answer_text ? a.answer_text.split(/\s+/).length : 0), 0) /
      Math.max(finalAnswers.length, 1);

    const confidenceScore = clamp(
      faceVisibleRatio * 40 + centeredRatio * 30 + (Math.min(avgWordsPerAnswer, 30) / 30) * 30,
      0,
      100
    );
    const nervousnessScore = clamp(movementScore * 55 + fillerRatio * 45, 0, 100);

    const payload = {
      candidate_email: extracted.email || localStorage.getItem("admin_email") || "",
      candidate_name: extracted.name || "",
      answers: finalAnswers,
      face_metrics: {
        confidence_level: toLevel(confidenceScore),
        nervousness_level: toLevel(nervousnessScore),
        confidence_score: Number(confidenceScore.toFixed(2)),
        nervousness_score: Number(nervousnessScore.toFixed(2)),
        face_visible_ratio: Number(faceVisibleRatio.toFixed(2)),
        centered_ratio: Number(centeredRatio.toFixed(2)),
        movement_score: Number(movementScore.toFixed(2)),
      },
    };

    try {
      const res = await api.post("/interview/session/complete", payload);
      const resultData = {
        ...res.data,
        payload,
      };
      localStorage.setItem("interview_result", JSON.stringify(resultData));
      navigate("/result");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to submit interview result.");
      setSaving(false);
    }
  };

  if (!questions.length) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Interview</h1>
          <p className="auth-subtitle">No interview questions found.</p>
          <button className="auth-btn" onClick={() => navigate("/login-success")}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="auth-page">
      <div className="auth-card interview-card">
        <h1 className="auth-title">Voice Interview</h1>
        <p className="auth-subtitle">
          Question {currentIndex + 1} of {questions.length}
        </p>

        {!sessionStarted && (
          <button className="auth-btn" onClick={startSession}>
            Start Session
          </button>
        )}

        {sessionStarted && (
          <>
            <video className="video-preview" ref={videoRef} autoPlay muted playsInline />
            <div className="status-row">
              <span>{cameraReady ? "Webcam active" : "Webcam unavailable"}</span>
              <span>{speaking ? "Asking question..." : "Ready"}</span>
              <span>{listening ? "Listening..." : "Mic idle"}</span>
            </div>
            <p>{cameraMessage}</p>
            <p>{micMessage}</p>

            <p><strong>Category:</strong> {currentQuestion.category}</p>
            {currentQuestion.topic && <p><strong>Topic:</strong> {currentQuestion.topic}</p>}
            <p><strong>Question:</strong> {currentQuestion.question}</p>

            <textarea
              className="auth-input"
              rows={5}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Your answer will appear here from voice-to-text."
            />

            <div className="auth-actions">
              <button className="auth-btn" onClick={() => askQuestionByVoice(currentQuestion.question)}>
                Repeat Question
              </button>
              {!listening ? (
                <button className="auth-btn" onClick={startListening}>
                  Start Voice Answer
                </button>
              ) : (
                <button className="auth-btn" onClick={stopListening}>
                  Stop Voice Answer
                </button>
              )}
            </div>

            <button className="auth-btn" onClick={nextQuestion} disabled={saving}>
              {currentIndex === questions.length - 1 ? "Finish Interview" : "Save & Next"}
            </button>
          </>
        )}

        {saving && <p>Saving interview session and analysis...</p>}
        {error && <div className="auth-error">{error}</div>}
      </div>
    </div>
  );
}
