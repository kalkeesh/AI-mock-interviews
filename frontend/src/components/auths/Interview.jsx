import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  CircleDot,
  Clock3,
  Mic,
  MicOff,
  PlayCircle,
  RefreshCcw,
  Sparkles,
  Volume2,
} from "lucide-react";
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

function normalizeGDTopic(item) {
  if (typeof item === "string") {
    const text = item.trim();
    return {
      category: "gd",
      topic: "Group Discussion",
      question: text,
      expected_answer: text,
    };
  }

  if (item && typeof item === "object") {
    const text = String(item.topic || item.question || item.title || "").trim();
    const expected = String(item.expected_answer || item.expected || text).trim();
    return {
      category: "gd",
      topic: "Group Discussion",
      question: text,
      expected_answer: expected,
    };
  }

  return {
    category: "gd",
    topic: "Group Discussion",
    question: "",
    expected_answer: "",
  };
}

function formatCountdown(totalSeconds) {
  const secs = Math.max(0, totalSeconds);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function Interview() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const micStreamRef = useRef(null);
  const recognitionRef = useRef(null);
  const shouldKeepListeningRef = useRef(false);
  const manualStopRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const detectorRef = useRef(null);
  const detectorTimerRef = useRef(null);
  const analysisCanvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const previewRafRef = useRef(null);
  const prevFrameRef = useRef(null);
  const askedAtRef = useRef({});
  const videoDevicesRef = useRef([]);
  const activeDeviceLabelRef = useRef("");
  const countdownRef = useRef(null);
  const forceSubmittedRef = useRef(false);

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
  const [cameraDebug, setCameraDebug] = useState("");
  const [activeCameraLabel, setActiveCameraLabel] = useState("");
  const [sessionMode, setSessionMode] = useState(
    localStorage.getItem("session_mode") === "gd" ? "gd" : "interview"
  );
  const [timerMinutes, setTimerMinutes] = useState(() => {
    const parsed = Number(localStorage.getItem("session_timer_minutes"));
    return [5, 7, 9].includes(parsed) ? parsed : 5;
  });
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(timerMinutes * 60);
  const [nextModePrompt, setNextModePrompt] = useState(false);
  const [nextModeTimer, setNextModeTimer] = useState(5);

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
    if (sessionMode === "gd") {
      const gd = interviewData?.data?.group_discussion;
      const one = normalizeGDTopic(gd);
      return one.question ? [one] : [];
    }

    const q = interviewData?.data?.interview_questions || {};
    return [
      ...(q.technical || []).map((item) => normalizeQuestion("technical", item)),
      ...(q.hr || []).map((item) => normalizeQuestion("hr", item)),
      ...(q.behavioral || []).map((item) => normalizeQuestion("behavioral", item)),
    ];
  }, [interviewData, sessionMode]);

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
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const segment = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${segment}`.trim();
        } else {
          interimText += `${segment} `;
        }
      }
      setCurrentAnswer(`${finalTranscriptRef.current} ${interimText}`.trim());
    };
    recognition.onstart = () => {
      setListening(true);
      setMicMessage("Listening and converting speech to text...");
    };
    recognition.onerror = (e) => {
      setListening(false);
      const err = e.error || "unknown";
      setMicMessage(`Mic error: ${err}`);
      // Auto-recover from transient speech errors while actively listening.
      if (shouldKeepListeningRef.current && !manualStopRef.current && err !== "not-allowed" && err !== "service-not-allowed") {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Ignore restart race conditions.
          }
        }, 250);
        return;
      }
      setError(`Speech recognition failed: ${err}`);
    };
    recognition.onend = () => {
      setListening(false);
      if (shouldKeepListeningRef.current && !manualStopRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Ignore restart race conditions.
          }
        }, 200);
        return;
      }
      setMicMessage("Mic idle");
    };
    recognitionRef.current = recognition;

    return () => {
      shouldKeepListeningRef.current = false;
      manualStopRef.current = true;
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

  useEffect(() => {
    if (!sessionStarted || saving || nextModePrompt) return;
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    countdownRef.current = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [sessionStarted, saving, nextModePrompt]);

  useEffect(() => {
    if (!sessionStarted || timeLeftSeconds > 0 || forceSubmittedRef.current) return;
    forceSubmittedRef.current = true;
    handleForceSubmit();
  }, [timeLeftSeconds, sessionStarted]);

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
    shouldKeepListeningRef.current = true;
    manualStopRef.current = false;
    finalTranscriptRef.current = currentAnswer.trim();
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
    shouldKeepListeningRef.current = false;
    manualStopRef.current = true;
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
    const isVirtualCamera = (label) =>
      /virtual|obs|droidcam|snap camera|manycam|xsplit|ndivirtual|camo/i.test(label || "");

    const listVideoDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === "videoinput");
        cams.sort((a, b) => {
          const aVirtual = isVirtualCamera(a.label);
          const bVirtual = isVirtualCamera(b.label);
          if (aVirtual === bVirtual) return 0;
          return aVirtual ? 1 : -1;
        });
        return cams;
      } catch {
        return [];
      }
    };

    const getFrameStats = (videoEl) => {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 54;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return { avg: 255, max: 255, nonBlackRatio: 1 };

      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let brightness = 0;
      let max = 0;
      let nonBlack = 0;
      const pixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const luma = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
        brightness += luma;
        if (luma > max) max = luma;
        if (luma > 10) nonBlack += 1;
      }
      return {
        avg: brightness / pixels,
        max,
        nonBlackRatio: nonBlack / pixels,
      };
    };

    const waitForVideoFrame = async (videoEl, timeoutMs = 3000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          return true;
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 80));
      }
      return false;
    };

    const startPreviewLoop = () => {
      if (!videoRef.current || !previewCanvasRef.current) return;
      const video = videoRef.current;
      const canvas = previewCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const draw = () => {
        if (!videoRef.current || !previewCanvasRef.current) return;

        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 360;
        if (canvas.width !== vw || canvas.height !== vh) {
          canvas.width = vw;
          canvas.height = vh;
        }

        ctx.save();
        // Mirror preview for user-friendly webcam behavior.
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch {
          // Ignore transient frame draw issues.
        }
        ctx.restore();

        previewRafRef.current = requestAnimationFrame(draw);
      };

      if (previewRafRef.current) {
        cancelAnimationFrame(previewRafRef.current);
        previewRafRef.current = null;
      }
      previewRafRef.current = requestAnimationFrame(draw);
    };

    const hasVisibleFrame = async (videoEl) => {
      const s1 = getFrameStats(videoEl);
      await new Promise((r) => setTimeout(r, 120));
      const s2 = getFrameStats(videoEl);
      const avg = (s1.avg + s2.avg) / 2;
      const max = Math.max(s1.max, s2.max);
      const nonBlackRatio = (s1.nonBlackRatio + s2.nonBlackRatio) / 2;
      return !(avg < 8 && max < 25 && nonBlackRatio < 0.01);
    };

    let lastError = "Unable to access webcam.";
    try {
      if (!videoRef.current || !previewCanvasRef.current) {
        throw new Error("Preview components are not mounted yet.");
      }

      // Prime permission so device labels are available for smarter selection.
      const primeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      primeStream.getTracks().forEach((track) => track.stop());

      const devices = await listVideoDevices();
      videoDevicesRef.current = devices;

      const baseVideo = { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user" };
      const candidates = [];

      if (devices.length) {
        devices.forEach((d) => {
          candidates.push({ video: { ...baseVideo, deviceId: { exact: d.deviceId } }, audio: false, _label: d.label || "Camera" });
        });
      } else {
        candidates.push({ video: baseVideo, audio: false, _label: "Default camera" });
      }

      candidates.push({ video: { width: { ideal: 640 }, height: { ideal: 360 } }, audio: false, _label: "Fallback camera profile" });
      candidates.push({ video: true, audio: false, _label: "Generic camera profile" });

      for (let i = 0; i < candidates.length; i += 1) {
        const { _label, ...constraints } = candidates[i];
        try {
          // eslint-disable-next-line no-await-in-loop
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          const track = stream.getVideoTracks()[0];
          if (!track || track.readyState !== "live") {
            stream.getTracks().forEach((t) => t.stop());
            throw new Error("Video track is not live.");
          }

          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = null;
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            videoRef.current.playsInline = true;

            // eslint-disable-next-line no-await-in-loop
            const frameReady = await waitForVideoFrame(videoRef.current);
            if (!frameReady) {
              throw new Error("Webcam stream opened but frames did not arrive.");
            }

            try {
              // eslint-disable-next-line no-await-in-loop
              await videoRef.current.play();
            } catch {
              // Ignore autoplay edge cases for local muted video.
            }

            // eslint-disable-next-line no-await-in-loop
            const visible = await hasVisibleFrame(videoRef.current);
            if (!visible) {
              throw new Error("Webcam is sending dark/blank frames.");
            }

            startPreviewLoop();
          }

          const label = track.label || _label || `Camera ${i + 1}`;
          activeDeviceLabelRef.current = label;
          setActiveCameraLabel(label);
          setCameraDebug(`Camera profile ${i + 1} selected. Active camera: ${label}`);
          lastError = "";
          break;
        } catch (err) {
          lastError = err?.message || "Unable to access webcam.";
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        }
      }

      if (!streamRef.current) {
        throw new Error(lastError);
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
      setCameraDebug("");
      return false;
    }
  };

  const stopCamera = () => {
    if (previewRafRef.current) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }
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
    setCameraDebug("");
    setActiveCameraLabel("");
  };

  const resetMetricsAndTracking = () => {
    metricsRef.current = {
      samples: 0,
      faceVisible: 0,
      centered: 0,
      movementScoreTotal: 0,
      lastCenter: null,
      totalWords: 0,
      fillerWords: 0,
    };
    prevFrameRef.current = null;
    askedAtRef.current = {};
    forceSubmittedRef.current = false;
  };

  const startSession = async () => {
    setError("");
    setNextModePrompt(false);
    setTimeLeftSeconds(timerMinutes * 60);
    forceSubmittedRef.current = false;
    finalTranscriptRef.current = "";
    // Mount preview elements before attaching MediaStream.
    setSessionStarted(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const ok = await startCamera();
    if (!ok) {
      setSessionStarted(false);
      return;
    }

    await startMic();
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

  const buildFinalAnswers = (fillRemaining = false) => {
    let nextAnswers = saveCurrentAnswer();
    if (!fillRemaining) {
      return nextAnswers.filter(Boolean);
    }

    const finalized = [...nextAnswers];
    const now = new Date().toISOString();
    for (let i = 0; i < questions.length; i += 1) {
      if (!finalized[i]) {
        finalized[i] = {
          question: questions[i].question,
          category: questions[i].category,
          expected_answer: questions[i].expected_answer || questions[i].question,
          answer_text: "",
          asked_at: askedAtRef.current[i] || now,
          answered_at: now,
          duration_seconds: 0,
        };
      }
    }
    setAnswers(finalized);
    return finalized;
  };

  const nextQuestion = () => {
    const nextAnswers = buildFinalAnswers(false);
    setCurrentAnswer("");
    finalTranscriptRef.current = "";
    stopListening();

    if (currentIndex >= questions.length - 1) {
      finishInterview(nextAnswers);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const proceedToResult = () => {
    navigate("/result");
  };

  const maybePromptForOtherMode = (storedResults) => {
    const otherMode = sessionMode === "interview" ? "gd" : "interview";
    if (storedResults[otherMode]) {
      proceedToResult();
      return;
    }
    setNextModeTimer(timerMinutes);
    setNextModePrompt(true);
  };

  const startOtherMode = () => {
    const otherMode = sessionMode === "interview" ? "gd" : "interview";
    setSessionMode(otherMode);
    localStorage.setItem("session_mode", otherMode);
    setTimerMinutes(nextModeTimer);
    localStorage.setItem("session_timer_minutes", String(nextModeTimer));

    setSessionStarted(false);
    setCurrentIndex(0);
    setCurrentAnswer("");
    setAnswers([]);
    setListening(false);
    setSpeaking(false);
    setSaving(false);
    setError("");
    setNextModePrompt(false);
    setTimeLeftSeconds(nextModeTimer * 60);
    resetMetricsAndTracking();
  };

  const finishInterview = async (finalAnswers, forcedByTimer = false) => {
    setSaving(true);
    window.speechSynthesis.cancel();
    stopListening();
    stopCamera();
    stopMic();
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

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
      session_mode: sessionMode,
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
        timer_minutes: timerMinutes,
        forced_by_timer: forcedByTimer,
      };

      const allResults = (() => {
        try {
          const raw = localStorage.getItem("session_results");
          return raw ? JSON.parse(raw) : {};
        } catch {
          return {};
        }
      })();
      allResults[sessionMode] = resultData;
      localStorage.setItem("session_results", JSON.stringify(allResults));
      localStorage.setItem("interview_result", JSON.stringify(resultData));

      setSaving(false);
      maybePromptForOtherMode(allResults);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to submit interview result.");
      setSaving(false);
    }
  };

  const handleForceSubmit = () => {
    if (saving || !sessionStarted) return;
    const finalAnswers = buildFinalAnswers(true);
    setCurrentAnswer("");
    finalTranscriptRef.current = "";
    finishInterview(finalAnswers, true);
  };

  if (!questions.length) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Interview</h1>
          <p className="auth-subtitle">
            {sessionMode === "gd" ? "No GD topic found." : "No interview questions found."}
          </p>
          <button className="auth-btn" onClick={() => navigate("/login-success")}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className={`auth-page ${sessionStarted ? "session-screen" : ""}`}>
      <div className={`auth-card interview-card ${sessionStarted ? "interview-card-full" : ""}`}>
        <div className="session-topbar">
          <div>
            <h1 className="auth-title">{sessionMode === "gd" ? "Group Discussion" : "Voice Interview"}</h1>
            <p className="auth-subtitle">
              {sessionMode === "gd"
                ? `GD Topic ${currentIndex + 1} of ${questions.length}`
                : `Question ${currentIndex + 1} of ${questions.length}`}
            </p>
            {sessionStarted && (
              <p className="meta-inline">
                <strong>Category:</strong> {currentQuestion.category || "-"}{" "}
                <span className="dot-sep">|</span>{" "}
                <strong>Topic:</strong> {currentQuestion.topic || (sessionMode === "gd" ? "Group Discussion" : "-")}
              </p>
            )}
          </div>
          <p className="session-timer top-right" title="Remaining session time">
            <Clock3 size={15} />
            <strong>{formatCountdown(timeLeftSeconds)}</strong>
          </p>
        </div>

        {!sessionStarted && (
          <section className="session-intro">
            <div className="session-intro-head">
              <p className="session-badge">
                <Sparkles size={14} />
                {sessionMode === "gd" ? "GD Warmup" : "Interview Warmup"}
              </p>
              <h2>
                {sessionMode === "gd"
                  ? "Get ready to speak clearly and stay concise."
                  : "Get ready for a focused voice interview."}
              </h2>
              <p>
                Once you start, camera and microphone permissions will be requested. Keep your face visible,
                speak in complete sentences, and use the full time effectively.
              </p>
            </div>

            <div className="session-instructions">
              <div className="instruction-item">
                <Camera size={16} />
                <span>Sit in good lighting and keep your face centered in the frame.</span>
              </div>
              <div className="instruction-item">
                <Mic size={16} />
                <span>Use a quiet environment and speak naturally for better transcript quality.</span>
              </div>
              <div className="instruction-item">
                <PlayCircle size={16} />
                <span>
                  Use <strong>Repeat Question</strong> any time. Answers are saved per question.
                </span>
              </div>
            </div>

            <button className="auth-btn start-session-btn" onClick={startSession}>
              <PlayCircle size={16} />
              Start Session
            </button>
          </section>
        )}

        {sessionStarted && (
          <div className="live-layout">
            <aside className="live-side">
              <canvas className="video-preview" ref={previewCanvasRef} />
              <video ref={videoRef} autoPlay muted playsInline style={{ display: "none" }} />

              <div className="status-row">
                <span>
                  <Camera size={14} />
                  {cameraReady ? "Webcam active" : "Webcam unavailable"}
                </span>
                <span>
                  <Volume2 size={14} />
                  {speaking ? "Asking question..." : "Ready"}
                </span>
                <span>
                  <Mic size={14} />
                  {listening ? "Listening..." : "Mic idle"}
                </span>
              </div>

              <div className="device-status-box">
                <p><strong>Camera:</strong> {cameraMessage}</p>
                <p><strong>Microphone:</strong> {micMessage}</p>
              </div>
            </aside>

            <section className="live-main">
              <div className="question-panel">
                <h3>{sessionMode === "gd" ? "GD Topic" : "Question"}</h3>
                <p className="question-text">{currentQuestion.question}</p>
                {sessionMode === "gd" && (
                  <p className="question-note">
                    Speak one clear paragraph on this topic. Live transcript is read-only.
                  </p>
                )}
              </div>

              <textarea
                className="auth-input answer-box"
                rows={8}
                value={currentAnswer}
                readOnly
                placeholder="Your answer will appear here from voice-to-text."
              />

              <div className="auth-actions live-actions">
                <button
                  className="auth-btn icon-btn"
                  onClick={() => askQuestionByVoice(currentQuestion.question)}
                  title="Repeat the current question by voice"
                  aria-label="Repeat question"
                >
                  <RefreshCcw size={16} />
                  Repeat
                </button>
                {!listening ? (
                  <button
                    className="auth-btn icon-btn"
                    onClick={startListening}
                    title="Start capturing your answer from microphone"
                    aria-label="Start voice answer"
                  >
                    <Mic size={16} />
                    Start Voice
                  </button>
                ) : (
                  <button
                    className="auth-btn icon-btn stop"
                    onClick={stopListening}
                    title="Stop microphone capture"
                    aria-label="Stop voice answer"
                  >
                    <MicOff size={16} />
                    Stop Voice
                  </button>
                )}
              </div>

              <button
                className="auth-btn icon-btn next-btn"
                onClick={nextQuestion}
                disabled={saving}
                title={
                  currentIndex === questions.length - 1
                    ? sessionMode === "gd"
                      ? "Submit and finish group discussion"
                      : "Submit and finish interview"
                    : "Save answer and go to next question"
                }
              >
                {currentIndex === questions.length - 1 ? <CheckCircle2 size={17} /> : <ArrowRight size={17} />}
                {currentIndex === questions.length - 1
                  ? sessionMode === "gd"
                    ? "Finish GD"
                    : "Finish Interview"
                  : "Save & Next"}
              </button>
            </section>
          </div>
        )}

        {nextModePrompt && (
          <div className="next-mode-modal">
            <div className="next-mode-card">
              <p className="next-mode-badge">
                <CircleDot size={14} />
                {sessionMode === "gd" ? "GD Submitted" : "Interview Submitted"}
              </p>
              <h3>
                {sessionMode === "gd"
                  ? "Start Interview Session Next?"
                  : "Start Group Discussion Next?"}
              </h3>
              <p>
                {sessionMode === "gd"
                  ? "Your group discussion was saved. You can continue with the interview round now."
                  : "Your interview round was saved. You can continue with the group discussion now."}
              </p>

              <p className="timer-label-inline">Select Timer</p>
              <div className="timer-chips-inline">
                {[5, 7, 9].map((value) => (
                  <button
                    key={`next-mode-${value}`}
                    type="button"
                    className={`timer-chip-inline ${nextModeTimer === value ? "active" : ""}`}
                    onClick={() => setNextModeTimer(value)}
                  >
                    {value} min
                  </button>
                ))}
              </div>

              <div className="auth-actions">
                <button
                  className="auth-btn"
                  onClick={proceedToResult}
                  title="Go to result without starting next round"
                >
                  Skip
                </button>
                <button
                  className="auth-btn next-btn icon-btn"
                  onClick={startOtherMode}
                  title={sessionMode === "gd" ? "Start interview now" : "Start GD now"}
                >
                  <PlayCircle size={16} />
                  {sessionMode === "gd" ? "Start Interview" : "Start GD"}
                </button>
              </div>
            </div>
          </div>
        )}

        {saving && <p>Saving interview session and analysis...</p>}
        {error && <div className="auth-error">{error}</div>}
      </div>
    </div>
  );
}
