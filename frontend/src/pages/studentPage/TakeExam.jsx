import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import axiosClient from "../../api/axiosClient";
import { SOCKET_URL } from "../../api/config";
import io from "socket.io-client";
import { useInactivityMonitor } from "../../hooks/useInactivityMonitor";
import { getDynamicViolationReason } from "../../utils/violationDictionary";
import {
  Monitor, AlertTriangle, Clock, Send, Moon, Sun, Menu, ArrowLeft, ShieldAlert, Check, CheckCircle2, X, Maximize2, HelpCircle
} from "lucide-react";

export default function TakeExam() {
  const { examId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const submissionId = search.get("submission_id");

  // ===== Device Detection =====
  const isMobileDevice = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isWidth = window.innerWidth < 768;
    return isTouch && (isWidth || /iphone|ipad|android|blackberry|mini|windows\sphone/.test(ua));
  }, []);

  // ===== Refs =====
  const socketRef = useRef(null);
  const qRefs = useRef({});
  const toastTimerRef = useRef(null);
  const tickRef = useRef(null);
  const cleanupListenersRef = useRef(null); // Lưu hàm cleanup để gọi khi nộp bài
  const submittedRef = useRef(false); // Ref để tracking submitted state (tránh stale closure)
  const monitoringActiveRef = useRef(false); // Ref để tracking khi nào bắt đầu giám sát (sau grace period)
  const lastViolationTimeRef = useRef({}); // Track last time each event was reported (prevent duplicates)
  const keyPressCountsRef = useRef({}); // Track consecutive presses per key to allow 1 safe press
  const failedReentryRef = useRef({}); // Track keys where automatic fullscreen re-entry failed (first-press)
  const fullscreenExitCountsRef = useRef({ count: 0, last: 0, timeout: null });
  const mouseOutsideCountRef = useRef(0);  // Track how many times mouse left browser
  const mouseOutsideTimerRef = useRef(null); // Timer for sustained mouse-outside detection
  const mouseOutsideStartRef = useRef(null); // When mouse first left the window
  const monitorScreenConfigRef = useRef(false); // Store the admin config for cheating monitoring
  const isCurrentlyExitedRef = useRef(false); // Track if student is currently 'out' to prevent strike spam

  // ===== State =====
  const [theme, setTheme] = useState(
    () => localStorage.getItem("examTheme") || "dark"
  ); // 'dark' | 'light'
  const [initError, setInitError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [examTitle, setExamTitle] = useState("Bài thi Demo UI");
  const [duration, setDuration] = useState(
    Number(sessionStorage.getItem("pending_exam_duration") || "60")
  );
  const [remaining, setRemaining] = useState(duration * 60);
  const [questions, setQuestions] = useState([]);
  const [violations, setViolations] = useState(() => {
    try {
      const saved = localStorage.getItem(`violations_${submissionId}`);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [toast, setToast] = useState({ msg: "", kind: "" }); // '', 'warn', 'danger'
  const [showModal, setShowModal] = useState(false);
  const [mcqScore, setMcqScore] = useState(0);
  const [aiScore, setAiScore] = useState(null);
  const [totalScore, setTotalScore] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false); // Đánh dấu đã nộp bài
  const [showConfirmModal, setShowConfirmModal] = useState(false); // Modal xác nhận nộp bài
  const [unansweredQuestions, setUnansweredQuestions] = useState([]); // Danh sách câu bỏ trống
  const [submitReason, setSubmitReason] = useState(null); // 'manual' | 'time' | 'violation'
  const [showMobileNav, setShowMobileNav] = useState(false); // Mobile drawer state
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false); // Overlay bắt buộc vào lại fullscreen
  const [monitoringActive, setMonitoringActive] = useState(false); // State for inactivity hook (not ref)
  const [showBlurOverlay, setShowBlurOverlay] = useState(false); // Blur overlay for focus loss
  const [showScreenshotProtection, setShowScreenshotProtection] = useState(false); // 3s black-out for anti-screenshot

  const flash = useCallback((msg, kind = "warn", ms = 1200) => {
    setToast({ msg, kind });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => setToast({ msg: "", kind: "" }),
      ms
    );
  }, []);

  const triggerScreenshotProtection = useCallback(() => {
    setShowScreenshotProtection(true);
    setTimeout(() => setShowScreenshotProtection(false), 3000); // 3s nuclear protection
  }, []);

  const notifyStudentReturned = useCallback(() => {
    // Reset focus state
    isCurrentlyExitedRef.current = false;

    // [New Logic] Xóa timer buffer nếu quay lại kịp (Bỏ qua thông báo hệ thống/Toast)
    if (window.__blurBufferTimer) {
        console.log("✅ [TakeExam] Student returned within grace period. Ignoring system notification blur.");
        clearTimeout(window.__blurBufferTimer);
        window.__blurBufferTimer = null;
    }

    if (socketRef.current) {
        socketRef.current.emit("student:returned", { submissionId });
    }

    // Lấy Snapshot ID đang quay hiện tại
    const currSnapshotId = currentSnapshotIdRef.current;
    if (!currSnapshotId) return;

    // [New Logic] Nếu quay lại từ Snipping Tool -> Chốt lỗi luôn (Bỏ qua buffer)
    if (window.__snippingDetected) {
        console.log("🚨 [TakeExam] Snipping Tool completion detected. Striking.");
        penalize("screenshot_attempt", "Hoàn tất thao tác chụp ảnh bằng Snipping Tool (Win+Shift+S).", "meta+shift+s", true);
        window.__snippingDetected = false;
    }

    // [New Logic] Keep recording for 10 more seconds after return (Sticky Recording)
    if (recordingRef.current) {
        console.log("[Recording] Student returned. Delaying stop for 10s to ensure clean exit...");
        clearTimeout(returnTimerRef.current);
        returnTimerRef.current = setTimeout(() => {
            if (!isCurrentlyExitedRef.current && recordingRef.current) {
                stopSnapshotCapture();
            }
        }, 10000); 
    }

    // Xóa bộ đếm Override 15s (SV đã quay lại an toàn)
    if (violationTimerRef.current[currSnapshotId]) {
      clearTimeout(violationTimerRef.current[currSnapshotId]);
      delete violationTimerRef.current[currSnapshotId];
    }

    const waitTimeVal = 10000;
    returnTimerRef.current = setTimeout(() => {
      if (currentSnapshotIdRef.current === currSnapshotId) {
        console.log(`[Recording] ${waitTimeVal}ms of sustained good behavior elapsed. Stopping capture cho vi phạm: ${currSnapshotId}`);
        stopSnapshotCapture();
        confirmedViolationRefs.current.delete(currSnapshotId);
      }
    }, waitTimeVal);
  }, [submissionId]);

  const scrollTo = useCallback((id) => {
    const el = document.getElementById(`q-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (qRefs.current[id]) {
      qRefs.current[id].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleSubmit = useCallback(async (reason = 'manual') => {
    if (submitting || submittedRef.current) return;
    setSubmitting(true);
    setSubmitReason(reason);

    setSubmitted(true);
    submittedRef.current = true;

    //Dừng hoàn toàn việc theo dõi màn hình - xóa tất cả event listeners
    if (cleanupListenersRef.current) {
      cleanupListenersRef.current();
      cleanupListenersRef.current = null;
    }

    try {
      const res = await axiosClient.post(`/submissions/${submissionId}/submit`);
      const beMcq =
        typeof res.data?.total_score === "number" ? res.data.total_score : null;
      const beAi = res.data?.ai_score ?? null;
      const beSum = res.data?.suggested_total_score ?? null;
      if (beMcq != null) setMcqScore(beMcq);
      if (beAi != null) setAiScore(beAi);
      if (beSum != null) setTotalScore(beSum);
      if (beMcq == null) {
        // Fallback: tính tạm theo options nếu có cờ is_correct
        const mcq = questions.reduce((acc, q) => {
          if (q.type !== "MCQ") return acc;
          const chosen = q.__selected;
          const ok = (q.options || []).some(
            (o) =>
              (o.is_correct || o.correct) &&
              (o.option_id === chosen || o.id === chosen)
          );
          return acc + (ok ? q.points || 1 : 0);
        }, 0);
        setMcqScore(mcq);
        setTotalScore(mcq + (beAi || 0));
      }
      setShowModal(true);

      sessionStorage.removeItem("pending_exam_duration");
      sessionStorage.removeItem("exam_flags");
      sessionStorage.removeItem(`exam_${examId}_started`);
      localStorage.removeItem("examTheme");
      localStorage.removeItem(`violations_${submissionId}`);

      console.log(
        "✅ [TakeExam] Exam submitted, session cleared, monitoring stopped"
      );

      try {
        await document.exitFullscreen?.();
      } catch { }

      // === FIX: Stop screen share stream so browser bar disappears ===
      try {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
          setScreenShared(false);
        }
      } catch { }
    } catch (err) {
      console.error("❌ [TakeExam] Submit error:", err);
      setShowModal(true);
    } finally {
      setSubmitting(false);
      if (reason !== 'manual') {
        flash(reason === 'time' ? "Hết giờ - Hệ thống tự động nộp bài" : "Vi phạm - Hệ thống tự động nộp bài", "danger", 3000);
      }
    }
  }, [submissionId, examId, questions, submitting]);

  const isAndroid = /Android/i.test(navigator.userAgent);

  // ===== AI / Real-time Events Refs =====
  const sessionEventsRef = useRef([]); // Thu thập events cho AI
  const aiCheckIntervalRef = useRef(null); // Interval Timer
  const lastAIFireRef = useRef(0); // Chống spam AI
  const lastInternalCopyContentRef = useRef(""); // 📋 [Smart Clipboard] Theo dõi nội dung copy nội bộ
  const AI_URL = import.meta.env.VITE_AI_URL || import.meta.env.VITE_AI_SERVER_URL || "https://ai.oes.io.vn";

  // ===== Snapshot & Recording Refs & State =====
  const mediaStreamRef = useRef(null);
  const snapshotIntervalRef = useRef(null);
  const snapshotsRef = useRef([]);
  const recordingRef = useRef(false);
  const returnTimerRef = useRef(null);
  const currentSnapshotIdRef = useRef(null); // ID for current violation frames
  const hiddenVideoRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const screenShareRequestingRef = useRef(false); // true khi dang hien dialog chia se man hinh
  const warningSoundRef = useRef(null);
  const alarmSoundRef = useRef(null);

  const [screenShared, setScreenShared] = useState(false);
  const [screenShareError, setScreenShareError] = useState(null);
  const altPressedRef = useRef(false);
  const metaPressedRef = useRef(false);
  const shiftPressedRef = useRef(false);
  const ctrlPressedRef = useRef(false);
  const lastWindowBlurTimeRef = useRef(0);
  const lastPowerChangeRef = useRef(0); // ⚡ Track timestamp of plug/unplug events
  const aiVerdictRef = useRef({}); // Mapping snapshotId -> verdict (true/false/pending)
  const violationTimerRef = useRef({}); // Mapping snapshotId -> TimerID for 5s fallback
  const confirmedViolationRefs = useRef(new Set()); // Current active violations requiring 10s return

  const requestScreenShare = async () => {
    try {
      setScreenShareError(null);
      // === FIX BUG 1: Mute onBlur/onVisibility khi dialog dang mo ===
      screenShareRequestingRef.current = true;
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor", cursor: "always" },
        audio: false
      });
      screenShareRequestingRef.current = false;

      // Ensure it's the entire screen if possible
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      if (settings.displaySurface && settings.displaySurface !== "monitor") {
        track.stop();
        setScreenShareError("Vui lòng chọn 'Entire Screen' (Toàn màn hình) thay vì tab/window.");
        return;
      }

      mediaStreamRef.current = stream;

      // Attach to hidden video for scraping
      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.srcObject = stream;
      }

      setScreenShared(true);
      // Hiển thị thông báo ngay khi chia sẻ thành công
      flash("✅ Chia sẻ màn hình thành công! Bạn có 10 giây ân xá để xử lý thanh công cụ. Hãy nhấn 'Hide' (Ẩn) thanh chia sẻ màn hình ngay bây giờ.", "success", 8000);

      // Listen for user stopping sharing manually via browser bar
      track.onended = () => {
        setScreenShared(false);
        setScreenShareError("Bạn đã tắt chia sẻ màn hình. Vui lòng tải lại trang và bật lại để tiếp tục bài thi.");
        // Try to penalize them if they stop it mid-exam
        if (!submittedRef.current) {
          penalize("screen_share_stopped", "Sinh viên đã chủ động ngắt chia sẻ màn hình - hành vi vi phạm bắt buộc đối với giám sát từ xa.", "screen_share");
        }
      };
    } catch (err) {
      console.error("Screen share error:", err);
      // === FIX BUG 1: reset flag ca khi user cancel dialog ===
      screenShareRequestingRef.current = false;
      setScreenShareError("Bạn phải cho phép chia sẻ 'Toàn màn hình / Entire Screen' để làm bài thi.");
    }
  };

  // ===== Recording Control Helpers =====
  const stopSnapshotCapture = () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    clearInterval(snapshotIntervalRef.current);
    clearTimeout(returnTimerRef.current);

    console.log(`[Recording] Stopped capturing. Total frames: ${snapshotsRef.current.length}`);

    if (snapshotsRef.current.length > 0) {
      // Background upload frames to backend
      const framesToUpload = [...snapshotsRef.current];
      snapshotsRef.current = [];
      const violationId = currentSnapshotIdRef.current || `V_${Date.now()}`;

      // Safe non-blocking upload
      axiosClient.post(`/submissions/${submissionId}/snapshots`, {
        violation_id: violationId,
        frames: framesToUpload,
        fps: 3
      }).then(() => {
        // Automatically trigger video merge after framing upload
        // Added 500ms delay to ensure backend has finished writing all files to disk
        setTimeout(() => {
          axiosClient.post(`/submissions/${submissionId}/videos/merge`, {
            violation_id: violationId
          }).catch(e => console.error("Video merge failed", e));
        }, 500);
      }).catch(err => console.error("Failed to upload snapshots", err));
    }
  };

  const startSnapshotCapture = (snapshotId = null) => {
    // 🔒 [Fix Race Condition] Dùng lock để ngăn chặn việc khởi động nhiều máy quay trong 1 lúc
    if (window.__isCapturingInternal) {
      console.warn("[Recording] Capture already in transition, queuing request:", snapshotId);
      setTimeout(() => startSnapshotCapture(snapshotId), 100);
      return;
    }

    // If we're already recording a *different* violation, stop that one first to ensure separate storage folders
    if (recordingRef.current && snapshotId && currentSnapshotIdRef.current !== snapshotId) {
      console.log(`[Recording] 🔄 Switching capture from ${currentSnapshotIdRef.current} to new violation ${snapshotId}`);
      // Đồng bộ ngắt quay cũ và bật lập tức quay mới, không dùng delay 300ms để tránh hụt frame
      window.__isCapturingInternal = true;
      stopSnapshotCapture();
      window.__isCapturingInternal = false;
    }

    if (recordingRef.current || !mediaStreamRef.current) return;

    if (snapshotId) {
      currentSnapshotIdRef.current = snapshotId;
    } else {
      currentSnapshotIdRef.current = `V_${Date.now()}`;
    }

    console.log(`[Recording] Started snapshot capture (3fps) for ${currentSnapshotIdRef.current}`);
    recordingRef.current = true;
    snapshotsRef.current = [];
    clearTimeout(returnTimerRef.current);

    const track = mediaStreamRef.current.getVideoTracks()[0];

    // === Use ImageCapture API directly from the stream track ===
    // Bypasses <video> element throttling that causes black frames when tab is in background
    if (!track) {
      console.error("[Recording] No video track available in stream");
      recordingRef.current = false;
      return;
    }
    if (typeof ImageCapture === "undefined") {
      // ImageCapture not supported (Firefox/Safari) - inform user to use Chrome
      console.error("[Recording] ❌ ImageCapture API not supported. Please use Chrome or Edge for proctoring.");
      flash("Trình duyệt không hỗ trợ giám sát. Vui lòng dùng Chrome hoặc Edge.", "danger", 5000);
      recordingRef.current = false;
      return;
    }

    const imageCapture = new ImageCapture(track);

    snapshotIntervalRef.current = setInterval(async () => {
      try {
        const bitmap = await imageCapture.grabFrame();
        const c = hiddenCanvasRef.current;
        if (!c) return;
        if (c.width !== bitmap.width || c.height !== bitmap.height) {
          c.width = bitmap.width;
          c.height = bitmap.height;
        }
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const frameData = c.toDataURL("image/webp", 0.6);
        snapshotsRef.current.push(frameData);
      } catch (err) {
        // grabFrame can fail if track ends - ignore silently
      }
    }, 333); // 3 FPS
  };





  // ===== Penalize callback for inactivity (defined early for hook) =====
  const penalizeInactivity = useCallback(async (evt, msg) => {
    if (submittedRef.current || !monitoringActiveRef.current) return;
    try {
      if (sessionStorage.getItem("exam_monitoring_active") !== "1") return;
    } catch (e) { }

    // Report to backend
    axiosClient.post(`/submissions/${submissionId}/proctor-event`, {
      event_type: evt,
      details: { message: msg, severity: "low" },
    }).catch(() => { });

    // Update violation count and check for auto-submit
      setViolations((currentCount) => {
        if (currentCount >= 50 || submittedRef.current) return currentCount;
        const newCount = currentCount + 1;
        
        // Sync to localStorage
        localStorage.setItem(`violations_${submissionId}`, newCount);

        if (newCount >= 50 && !submittedRef.current) {
          handleSubmit('violation');
        }
        return newCount;
      });
  }, [submissionId, examId]);

  // ===== Inactivity Monitor Hook =====
  // 30s idle = warning sound, 60s idle = low-severity violation
  const flashInactivity = useCallback((msg, kind, ms) => {
    setToast({ msg, kind });
    setTimeout(() => setToast({ msg: "", kind: "" }), ms);
  }, []);

  useInactivityMonitor({
    enabled: !submitted && monitoringActive, // Use STATE, not ref
    onWarning: () => console.log("⚠️ [Inactivity] 30s warning triggered"),
    onViolation: penalizeInactivity,
    flash: flashInactivity,
  });

  // ===== Battery / Power Change Monitoring =====
  useEffect(() => {
    let batteryObj = null;

    const handleChargingChange = () => {
      console.log("⚡ [TakeExam] Power state change detected (Plug/Unplug)");
      lastPowerChangeRef.current = Date.now();
    };

    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        batteryObj = battery;
        battery.addEventListener('chargingchange', handleChargingChange);
      }).catch(e => console.warn("[TakeExam] Battery API failed:", e));
    }

    return () => {
      if (batteryObj) {
        batteryObj.removeEventListener('chargingchange', handleChargingChange);
      }
    };
  }, []);

  // ===== Block navigation after submit =====
  useEffect(() => {
    if (!submitted) return;

    const handlePopState = (e) => {
      e.preventDefault();
      console.warn("⚠️ [TakeExam] Navigation blocked - exam already submitted");

      // Logout và xóa toàn bộ token
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.clear();

      // Redirect về verify-room
      window.location.href = "/verify-room";
    };

    window.addEventListener("popstate", handlePopState);
    window.history.pushState(null, "", window.location.href);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [submitted]);

  // ===== Audio Init =====
  useEffect(() => {
    try {
      warningSoundRef.current = new Audio("/sounds/ting_warning.mp3");
      warningSoundRef.current.volume = 0.7;
      alarmSoundRef.current = new Audio("/sounds/alarm.mp3");
      alarmSoundRef.current.volume = 0.8;
    } catch (e) {
      console.warn("[TakeExam] Cannot load sounds:", e);
    }
  }, []);

  // ===== Theme persist =====
  useEffect(() => {
    try {
      localStorage.setItem("examTheme", theme);
    } catch { }
    if (theme === "light") document.documentElement.classList.remove("dark");
    else document.documentElement.classList.add("dark");
  }, [theme]);

  // ===== Load & Start =====
  useEffect(() => {
    const start = async () => {
      if (!submissionId) {
        // navigate("/verify-room");
        setInitError("DEBUG: Missing submission_id in URL");
        setLoading(false);
        return;
      }

      // GUARD: Kiểm tra submission đã nộp chưa
      try {
        const checkRes = await axiosClient.get(
          `/submissions/${submissionId}/status`
        );
        if (checkRes.data?.submitted_at) {
          console.warn(
            "⚠️ [TakeExam] Submission already submitted, logging out..."
          );

          // Logout và xóa token
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          sessionStorage.clear();

          // Redirect về verify-room
          // window.location.href = "/verify-room";
          setInitError(`DEBUG: Status check failed. Status: ${checkRes.data?.status}, SubmittedAt: ${checkRes.data?.submitted_at}`);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("❌ [TakeExam] Error checking submission status:", err);
      }

      try {
        const res = await axiosClient.post(
          `/submissions/${submissionId}/start`
        );
        const qs = res.data?.questions || [];
        const opts = res.data?.options || [];
        const ans = res.data?.answers || [];
        const byAns = new Map(ans.map((a) => [a.question_id, a]));
        const optsByQ = (opts || []).reduce((acc, o) => {
          (acc[o.question_id] ||= []).push(o);
          return acc;
        }, {});
        const merged = qs.map((q) => {
          const base = { ...q };
          base.points = base.points ?? 1;
          base.options =
            q.type === "MCQ" ? q.options || optsByQ[q.question_id] || [] : [];
          const a = byAns.get(q.question_id);
          base.__selected = a?.selected_option_id || null;
          base.__answer_text = a?.answer_text || "";
          base.__answered = !!(
            a?.selected_option_id ||
            (a?.answer_text && a.answer_text.trim())
          );
          return base;
        });
        let finalQuestions = merged;

        setQuestions(finalQuestions);
        setDuration(res.data?.duration_minutes || duration);

        const startedAt = res.data?.started_at
          ? new Date(res.data.started_at).getTime()
          : Date.now();
        const serverNow = res.data?.server_now
          ? new Date(res.data.server_now).getTime()
          : Date.now();
        const durSec = (res.data?.duration_minutes || duration) * 60;
        const passed = Math.max(0, Math.floor((serverNow - startedAt) / 1000));

        let calculatedRemaining = Math.max(0, durSec - passed);
        if (res.data?.seconds_until_close !== undefined && res.data?.seconds_until_close !== null) {
          calculatedRemaining = Math.min(calculatedRemaining, Math.max(0, res.data.seconds_until_close));
        } else if (res.data?.time_close) {
          const closeTime = new Date(res.data.time_close).getTime();
          const secondsUntilClose = Math.floor((closeTime - serverNow) / 1000);
          calculatedRemaining = Math.min(calculatedRemaining, Math.max(0, secondsUntilClose));
        }

        setRemaining(calculatedRemaining);

        setExamTitle(res.data?.exam_title || `Bài thi #${examId}`);
        monitorScreenConfigRef.current = !!res.data?.monitor_screen;

        if (res.data?.monitor_screen) {
          // Hiển thị thông báo bắt đầu giám sát
          flash(
            "📹 Hệ thống giám sát đã kích hoạt. Giữ toàn màn hình!",
            "warn",
            3000
          );
        } else {
          flash(
            "ℹ️ Chế độ thi toàn màn hình được bật.",
            "success",
            3000
          );
        }

        // [New Logic] Cảnh báo Pin yếu ngay khi vào bài thi
        try {
          const sysContext = await getSystemContext();
          if (sysContext.battery_level < 0.2 && !sysContext.is_charging) {
            flash(`⚠️ PIN YẾU (${Math.round(sysContext.battery_level * 100)}%): Vui lòng cắm sạc để tránh bị ngắt quãng do thông báo hệ thống!`, "danger", 5000);
          }
        } catch (e) {}

        if (document.documentElement.requestFullscreen) {
          try {
            await document.documentElement.requestFullscreen().catch(() => {
              console.log(
                "ℹ️ [TakeExam] Fullscreen request ignored (need user gesture)"
              );
            });
          } catch (err) {
            console.log("ℹ️ [TakeExam] Fullscreen not available:", err.message);
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("❌ Warning: Failed to initialize exam:", error);
        if (error.response) {
          const status = error.response.status;
          const msg = error.response.data?.message || "Unknown error";
          // 400: Submitted/Graded, 401: Unauthorized, 403: Forbidden (Verification needed/Time limits), 404: Not found
          if (status === 403 || status === 400 || status === 401 || status === 404) {
            // DEBUG: Show error instead of redirect to diagnose issues
            setInitError(`Lỗi khởi tạo (${status}): ${msg}`);
            setLoading(false);
            return;
          }
        }
        // Network/Server errors -> Show Retry UI
        setInitError("Lỗi kết nối máy chủ. Vui lòng kiểm tra lại mạng và thử lại.");
        setLoading(false);
      }
    };

    const postProctor = async (evt, details = {}) => {
      try {
        console.log(
          `📤 [Proctor] Sending event: ${evt} for submission ${submissionId}`
        );
        const response = await axiosClient.post(
          `/submissions/${submissionId}/proctor-event`,
          {
            event_type: evt,
            details,
          }
        );
        console.log(`✅ [Proctor] ${evt} logged:`, response.data);
      } catch (error) {
        console.error(
          `❌ [Proctor] Failed to log ${evt}:`,
          error.response?.data || error.message
        );
      }
    };


    const getSystemContext = async () => {
      const ctx = {
        battery_level: 1.0,
        is_charging: true,
        network_rtt: 0,
        network_type: 'unknown',
        timestamp: Date.now()
      };

      try {
        if (navigator.getBattery) {
          const battery = await navigator.getBattery();
          ctx.battery_level = battery.level;
          ctx.is_charging = battery.charging;
        }
      } catch (e) { }

      try {
        // @ts-ignore
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn) {
          ctx.network_rtt = conn.rtt || 0;
          ctx.network_type = conn.effectiveType || 'unknown';
        }
      } catch (e) { }

      return ctx;
    };

    const isLegitimateContext = (ctx) => {
      if (!ctx) return false;
      // [Update] Tăng ngưỡng lên 20% (0.2) để khớp với thông báo Low Battery của Windows (thường ở 20% hoặc 15%)
      const isBatteryCritical = ctx.battery_level !== undefined && ctx.battery_level < 0.2 && !ctx.is_charging;
      const isNetworkLagging = ctx.network_rtt !== undefined && ctx.network_rtt > 500;
      
      // [New] 5-second amnesty after plugging/unplugging charger
      const isRecentPowerChange = lastPowerChangeRef.current > 0 && (Date.now() - lastPowerChangeRef.current < 5000);

      if (isRecentPowerChange) {
        console.log("🛡️ [ContextShield] Bypassing violation due to recent power change event.");
      }

      return isBatteryCritical || isNetworkLagging || isRecentPowerChange;
    };

    const penalize = async (evt, msg, key = null, isViolation = false, isWarningOnly = false, extraDetails = {}) => {
      if (window.__isUnloadingApp) return;
      if (submittedRef.current) {
        console.log(
          "🛑 [TakeExam] Violation ignored - exam already submitted:",
          evt
        );
        return;
      }

      // 📱 Mobile Logic: Certain events are instant strike by default
      const MOBILE_STRICT_EVENTS = ["visibility_hidden", "window_blur", "fullscreen_lost", "screenshot_attempt"];
      if (isMobileDevice && MOBILE_STRICT_EVENTS.includes(evt) && !isWarningOnly) {
        isViolation = true;
      }

      // Extra-safety: require both local monitoring active and sessionStorage flag
      if (!monitoringActiveRef.current) {
        console.log(
          "⏳ [TakeExam] Violation ignored - monitoring not active yet (grace period):",
          evt
        );
        return;
      }
      try {
        if (sessionStorage.getItem("exam_monitoring_active") !== "1") {
          console.log(
            "⏳ [TakeExam] Violation ignored - session monitoring flag not set",
            evt
          );
          return;
        }
      } catch (e) {
        // ignore storage errors and proceed
      }

      // 1. SHARED FOCUS GROUP THROTTLE (Nuclear Protection against triple counting)
      // Nhóm các lỗi thoát ứng dụng: Alt+Tab, Win+D, Blur, Visibility, Blocked Hardware Keys...
      // Chỉ CHO PHÉP MỘT sự kiện trong nhóm này được tính trong vòng 3.5s
      const SHARED_FOCUS_EVENTS = [
        "visibility_hidden", 
        "window_blur", 
        "fullscreen_lost", 
        "split_screen", 
        "alt_tab", 
        "screenshot_attempt", 
        "blocked_key"
      ];
      
      const now = Date.now();
      
      // [Nuclear Aggression] Bypass throttle for repeated Esc/F11 SPAM (<2s)
      const isRepeatedEscF11 = (evt === 'blocked_key' && (key === 'escape' || key === 'f11')) && 
                               (lastViolationTimeRef.current["__shared_focus"] && now - lastViolationTimeRef.current["__shared_focus"] < 2000);

      if (SHARED_FOCUS_EVENTS.includes(evt) && !isRepeatedEscF11) {
        const lastShared = lastViolationTimeRef.current["__shared_focus"];
        if (lastShared && now - lastShared < 1000) { // Slashed from 3500ms to 1000ms
          console.log(`Array [TakeExam] SHARED FOCUS THROTTLE: Bỏ qua ${evt} (${now - lastShared}ms sau lỗi thoát trước)`);
          return;
        }
      }
      
      lastViolationTimeRef.current["__shared_focus"] = now;
      if (isRepeatedEscF11) console.log("🚨 [TakeExam] Nuclear SPAM bypass triggered for Esc/F11!");
      window.__lastBlockKeyTimestamp = now; // Đồng bộ toàn cục để chặn triệt thễ onVis/onFs/onKey

      // 2. Individual event throttling (1s - fallback)
      const lastTime = lastViolationTimeRef.current[evt];
      if (!isViolation && lastTime !== undefined && now - lastTime < 1000) {
        console.log(
          `⏸️ [TakeExam] Violation throttled (${evt}), last report: ${now - lastTime}ms ago`
        );
        return;
      }

      // 1. KIỂM TRA NGỮ CẢNH HỆ THỐNG TRƯỚC (Bypass nếu là sự kiện hợp lệ)
      const sysContext = await getSystemContext();
      if (isLegitimateContext(sysContext)) {
        console.log(`🛡️ [AI Bypass] Bỏ qua lỗi ${evt} do ngữ cảnh hợp lệ (Pin: ${sysContext.battery_level}, RTT: ${sysContext.network_rtt})`);
        flash("🛡️ Hệ thống phát hiện hoạt động nền của máy tính (Pin/Mạng). Đã bỏ qua.", "success", 3000);
        return;
      }

      // 2. TÁCH VIDEO ĐỘC LẬP VÀ KÍCH HOẠT MÁY QUAY
      const randomId = Math.random().toString(36).substring(7);
      const snapshotId = `V_${Date.now()}_${randomId}_${evt}`;
      startSnapshotCapture(snapshotId);

      // 4. GỌI AI VỚI TIMEOUT 2 GIÂY
      try {
        aiVerdictRef.current[snapshotId] = 'pending';
        const studentId = localStorage.getItem("student_id") || "0";
        
        // Tạo promise gọi AI
        const aiCall = axiosClient.post(`${AI_URL}/api/ai/detect-behavior`, {
          student_id: parseInt(studentId),
          exam_id: parseInt(examId),
          events: [{ 
            event_type: evt, 
            timestamp: Date.now(), 
            details: { 
              message: msg, 
              key,
              window_title: document.title,
              ...extraDetails
            },
            context: sysContext
          }],
          window_duration_seconds: 15
        }, { baseURL: "", timeout: 2000 }); // Timeout 2s

        const res = await aiCall;
        const aiData = res.data?.data || res.data;
        const isCheatingAI = aiData && aiData.is_cheating;
        const aiReason = (aiData && aiData.reason) ? aiData.reason : msg;

        aiVerdictRef.current[snapshotId] = isCheatingAI;

        if (isCheatingAI) {
            console.log(`🚨 [AI Verdict] Confirm Cheating: ${evt}`);
            flash(`🚨 AI PHÁT HIỆN GIAN LẬN: ${aiReason}`, "danger", 5000);
            // [Authoritative] Any AI confirmation here results in +1, regardless of caller's isViolation flag
            await commitViolation(evt, snapshotId, `[AI PHÊ DUYỆT]: ${aiReason}`, key, true);
        } else {
            console.log(`✅ [AI Verdict] Legitimate behavior: ${evt}. Cleaning up evidence...`);
            flash("✅ AI xác nhận hành vi an toàn.", "success", 2000);
            
            // 🧹 DỌN DẸP BẰNG CHỨNG (DO AI PHÁN AN TOÀN)
            stopSnapshotCapture();
            // Xóa snapshot trên server (nếu đã kịp upload frames nào)
            axiosClient.delete(`/submissions/${submissionId}/snapshots/${snapshotId}`).catch(() => { });
        }
      } catch (err) {
        // FALLBACK: AI lỗi hoặc quá 2s -> Nếu là phím cứng cấm tuyệt đối thì CHỐT LỖI LUÔN để tránh lách luật bằng cách spam server
        const HARD_KEYS = ["Escape", "F11", "F12", "F5", "alt_tab", "copy_attempt", "paste_attempt"];
        const isHardFail = HARD_KEYS.includes(evt) || HARD_KEYS.includes(key);

        if (isHardFail) {
            console.error("🚨 [AI Offline] Hard violation detected but AI service failed. Forcing strike.");
            flash(`🚨 VI PHẠM HỆ THỐNG: ${msg}`, "danger", 5000);
            await commitViolation(evt, snapshotId, `[AI Offline - Force Strike]: ${msg}`, key, true);
        } else {
            console.warn("[AI Fallback] AI timeout/error, applying Warning-Only:", err.message);
            flash("⚠️ Phát hiện hành vi bất thường. Hệ thống đang theo dõi.", "warning", 3000);
        }
      }
    };

    const commitViolation = async (evt, snapshotId, msg, contextKey = null, isViolation = true) => {
      if (submittedRef.current) return;

      // Nếu chỉ là Warning (không phải Violation) thì dừng tại đây, không tăng counter 1/5
      if (!isViolation) {
        console.log(`ℹ️ [TakeExam] Warning only (skipped DB log & counter): ${evt}`);
        return;
      }

      // 🛑 INSTANT FEEDBACK: Cập nhật số lỗi và nộp bài NGAY LẬP TỨC nếu là lỗi thứ 50
      // Chúng ta thực hiện việc này TRƯỚC KHI await postProctor để sinh viên thấy thông báo n/50 ngay lập tức
      setViolations((prev) => {
        if (prev >= 10) return prev;
        const nv = prev + 1;
        
        // Sync to localStorage
        localStorage.setItem(`violations_${submissionId}`, nv);

        try {
          if (nv >= 10) {
            if (alarmSoundRef.current) alarmSoundRef.current.play().catch(() => { });
            flash(`🚨 VI PHẠM TỐI ĐA: ${nv}/10 — HỆ THỐNG SẼ ĐÓNG BÀI SAU 2 GIÂY...`, "danger", 10000);
            if (!submittedRef.current) {
              console.log("🛑 [AutoSubmit] 10th violation reached, waiting 2s for camera to capture evidence...");
              // Chờ 2 giây để máy quay ăn đủ Frame chứng cứ trước khi Sập Nguồn
              setTimeout(() => {
                if (!submittedRef.current) handleSubmit('violation');
              }, 2000);
            }
          } else {
            if (warningSoundRef.current) {
              warningSoundRef.current.currentTime = 0;
              warningSoundRef.current.play().catch(() => { });
            }
            flash(`❌ VI PHẠM QUY CHẾ: ${nv}/10`, "danger", 4000);
          }
        } catch (err) {
          console.error("❌ [TakeExam] UI notification failed:", err);
        }
        return nv;
      });

      // 1. Ghi log Database và Alert Giảng viên (ASYNC - Đảm bảo log được lưu)
      try {
        const sysContext = await getSystemContext();
        await postProctor(evt, {
          message: msg,
          key: contextKey,
          snapshot_id: snapshotId,
          severity: 'high',
          context: sysContext
        });
        console.log(`✅ [TakeExam] Violation committed to DB: ${evt}`);
      } catch (e) {
        console.error("❌ [TakeExam] postProctor failed:", e);
      }
    };

    // Mobile specific: Split screen / PIP detection
    const checkMobileIntegrity = () => {
      if (!isMobileDevice) return;

      // Skip check if user is typing (virtual keyboard shrinks viewport)
      const ae = document.activeElement;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) {
        return;
      }

      // Check mobile split screen
      if (isMobileDevice) {
        if (window.innerWidth < window.screen.width * 0.9) {
          penalize("split_screen", "[MOBILE] Thí sinh đang sử dụng chế độ CHIA ĐÔI MÀN HÌNH (Split Screen) hoặc Cửa sổ nổi hòng xem tài liệu song song.", null, true);
          // [PROTECTION] Bật khung bảo vệ toàn màn hình để ngăn chặn việc xem đề thi ở cửa sổ nhỏ
          setShowFullscreenOverlay(true);
        }
      } else {
        // Desktop check for multiple monitors using modern Window Management API loosely
        try {
          if (window.screen && window.screen.isExtended) {
            penalize("multi_monitor_attempt", getDynamicViolationReason("multiple_screens_connected", null, "Phát hiện kết nối nhiều màn hình (Dual monitor) để xem tài liệu trên màn hình phụ."), "extended_display");
          }
        } catch (e) { }
      }
    };

    const mobileCheckInterval = setInterval(checkMobileIntegrity, 2000); // Polling every 2s instead of 3s for higher sensitivity


    // Fullscreenchange handler (separate from penalize)
    const onFs = () => {
      const isCurrentlyFs = !!document.fullscreenElement;
      const isActuallyExit = !isCurrentlyFs;

      if (isActuallyExit && !submittedRef.current) {
        const now = Date.now();
        window.__lastFsExitTimestamp = now;
        console.log("🚨 [TakeExam] Fullscreen EXIT detected.");

        // [Refinement] Try auto-restore first
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen()
            .then(() => {
              console.log("✅ [TakeExam] Fullscreen auto-restored successfully");
              flash("⚠️ Đã tự động khôi phục toàn màn hình. Vui lòng không thoát chế độ này!", "warning", 3000);
              setShowFullscreenOverlay(false);
            })
            .catch(() => {
              // Browser rejected auto-restore (usually needs user gesture or mobile split-screen)
              if (monitoringActiveRef.current) {
                setShowFullscreenOverlay(true);
                if (isMobileDevice) {
                  penalize("fullscreen_lost", "[MOBILE] Thí sinh đã THOÁT CHẾ ĐỘ THI TẬP TRUNG (Fullscreen).", null, true);
                }
              }
            });
        } else {
          setShowFullscreenOverlay(true);
        }
      } else if (isCurrentlyFs) {
        // Returned to FS
        setShowFullscreenOverlay(false);
      }
    };
    const onVis = () => {
      if (document.hidden) {
        // Triệt tiêu hiệu ứng phụ: Nếu vừa bấm phím cứng HOÀN vừa thoát fullscreen
        const now = Date.now();
        const recentBlockKey = window.__lastBlockKeyTimestamp && (now - window.__lastBlockKeyTimestamp < 2000);
        const recentFsExit = window.__lastFsExitTimestamp && (now - window.__lastFsExitTimestamp < 2000);
        if (recentBlockKey || recentFsExit) {
          console.log("ℹ️ [TakeExam] Bỏ qua visibility_hidden do hệ quả của thao tác phím cứng/thoát FS.");
          return;
        }

        lastViolationTimeRef.current["_hide_start"] = Date.now();
        const msg = getDynamicViolationReason("visibility_hidden", null,
          isMobileDevice ? "[MOBILE] Thí sinh đã CHUYỂN TAB hoặc ẨN TRÌNH DUYỆT (Nhấn Home/Vuốt lên) để thoát khỏi bài thi." : "Ẩn tab bài thi xuống (Mở một cửa sổ khác đè lên trên)."
        );

        // 📱 Mobile: Instant Strike + Visual Protection
        // [Flexible Proctoring] Chỉ tính lỗi nếu giám sát đang bật
        if (isMobileDevice) {
           if (!monitoringActiveRef.current) {
             flash(`⚠️ [Cảnh báo] ${msg} (Giám sát hiện đang tắt)`, "warning", 4000);
           } else {
             penalize("visibility_hidden", msg, null, true);
           }
           // [PROTECTION] Nuclear black-out on mobile whenever backgrounded (anti-screenshot/exit)
           triggerScreenshotProtection();
        }
      } else {
        notifyStudentReturned();

        // Log duration for AI if available
        const hideStart = lastViolationTimeRef.current["_hide_start"];
        if (hideStart) {
          const duration = Date.now() - hideStart;
          sessionEventsRef.current.push({
            event_type: "visibility_hidden_duration",
            timestamp: Date.now(),
            details: { duration_ms: duration }
          });
          delete lastViolationTimeRef.current["_hide_start"];
        }
      }
    };
    const onBlur = (e) => {
      // === FIX BUG 1: Bo qua neu dang hien dialog chia se man hinh ===
      if (screenShareRequestingRef.current) {
        console.log("[TakeExam] onBlur ignored - screen share dialog is open");
        return;
      }

      // === FIX: Nếu fullscreen không active, blur là hệ quả của thoát FS -> để onFs xử lý ===
      if (!document.fullscreenElement && !isMobileDevice) {
        console.log("ℹ️ [TakeExam] onBlur: Fullscreen không active, bỏ qua (onFs sẽ xử lý).");
        return;
      }

      const blurTimestamp = Date.now();
      lastViolationTimeRef.current["_blur_start"] = blurTimestamp;

      // Blur overlay on mobile device is distracting, we just penalize
      if (!isMobileDevice) setShowBlurOverlay(true);

      const now = Date.now();
      lastWindowBlurTimeRef.current = now;

      let msg = getDynamicViolationReason("window_blur", null,
        isMobileDevice ? "[MOBILE] Thí sinh đã MẤT TIÊU ĐIỂM - Nghi ngờ nhấn thông báo hoặc chuyển sang ứng dụng khác." : "Click chuột ra ngoài cửa sổ trình duyệt thi."
      );

      let evt = "window_blur";
      let keyId = "window_blur";
      let isViolationParam = isMobileDevice; // Default to instant on mobile device
      let isSystemShortcut = false;

      // 🕵️ Precise detection of OS shortcuts causing blur (Windows/Mac)
      if (altPressedRef.current) {
        evt = "alt_tab";
        keyId = "alt+tab";
        msg = getDynamicViolationReason("blocked_key", "alt+tab", "Nhấn phím tắt Alt+Tab để chuyển nhanh sang ứng dụng/tài liệu khác.");
        isSystemShortcut = true;
      }
      else if (metaPressedRef.current && shiftPressedRef.current) {
        // [Precision Shield] Instant strike for snippets
        evt = "screenshot_attempt";
        keyId = "meta+shift+s";
        msg = getDynamicViolationReason("screenshot_attempt", "meta+shift+s", "Mở công cụ cắt/chụp ảnh màn hình (Snipping Tool) của Windows.");
        isSystemShortcut = true;
      }
      else if (metaPressedRef.current) {
        isSystemShortcut = true;
        // Phân biệt Win+D vs Win+P dựa trên combo đã bắt được từ onKey
        const lastWinCombo = window.__lastWinCombo || null;
        if (lastWinCombo === "meta+p") {
          evt = "blocked_key";
          keyId = "meta+p";
          msg = getDynamicViolationReason("blocked_key", "meta+p", "Kích hoạt Bảng chia sẻ màn hình phụ (Win+P / Project) hòng phát đề thi ra ngoài.");
        } else if (lastWinCombo === "meta+d") {
          evt = "blocked_key";
          keyId = "meta+d";
          msg = getDynamicViolationReason("blocked_key", "meta+d", "Nhanh chóng thu nhỏ toàn bộ bài thi để về Màn hình chính (Win+D / Desktop).");
        } else {
          evt = "blocked_key";
          keyId = "meta_key";
          msg = getDynamicViolationReason("blocked_key", "meta_key", "Nhấn phím Windows kết hợp Click chuột vào ứng dụng khác để thoát bài thi.");
        }
        window.__lastWinCombo = null;
        
        // [Precision Shield] Phân nhánh: Win+D/P (Phạt ngay) vs Win đơn lẻ (Đợi 1s)
        if (keyId === "meta+d" || keyId === "meta+p") {
          console.log(`🚨 [onBlur] Instant Strike for Absolute Violation: ${keyId}`);
          penalize(evt, msg, keyId, true, false); 
          window.__lastBlockKeyTimestamp = Date.now();
        } else {
          const metaBufferTime = 1000;
          console.log(`ℹ️ [onBlur] meta_key detected. Routing through ${metaBufferTime}ms Precision Shield.`);
          window.__blurBufferTimer = setTimeout(() => {
            if (isCurrentlyExitedRef.current) {
              const durationMs = Date.now() - now;
              console.log(`🚨 [onBlur] Meta-Blur confirmed after ${durationMs}ms. Striking.`);
              penalize(evt, msg, keyId, true, false, { duration_ms: durationMs }); 
              window.__lastBlockKeyTimestamp = Date.now();
            }
          }, metaBufferTime);
        }
        return; 
      }

      // 🛡️ [Refined Logic] Split between Instant Strike vs Warning-First
      if (isSystemShortcut) {
        window.__warnedKeys = window.__warnedKeys || {};
        window.__keyPressTracker = window.__keyPressTracker || {};
        const lastPress = window.__keyPressTracker[keyId] || 0;
        const isFastRepeat = lastPress > 0 && (now - lastPress) < 2000;
        const alreadyWarned = window.__warnedKeys[keyId] || false;

        // Reset warning if it's been a long time (e.g. 10s)
        if (lastPress > 0 && now - lastPress > 10000) {
          window.__warnedKeys[keyId] = false;
        }

        const isSeriousShortcut = ["alt+tab", "meta+d", "meta+p", "meta+shift+s"].includes(keyId);
        
        window.__keyPressTracker[keyId] = now;

        if (isSeriousShortcut) {
            console.log(`🚀 [onBlur] Instant Strike for Serious Shortcut: ${keyId}`);
            penalize(evt, msg, keyId, true, false); 
            window.__lastBlockKeyTimestamp = Date.now();
            return; 
        }
        
        // [Refinement] Other system keys (non-meta) lead to buffer
        console.log(`ℹ️ [onBlur] ${keyId} detected. Routing through 1.0s buffer.`);
      }

      // Fallback for generic blur (click outside)
      // Check for recent suppression
      const recentBlockKey = window.__lastBlockKeyTimestamp && (now - window.__lastBlockKeyTimestamp < 2000);
      const recentFsExit = window.__lastFsExitTimestamp && (now - window.__lastFsExitTimestamp < 2000);
      if (recentBlockKey || recentFsExit) {
        console.log(`ℹ️ [TakeExam] Bỏ qua lỗi ${evt} do hệ quả của phím cứng/thoát FS.`);
        return;
      }

      // [Smart Layered Buffer] 
      // 0.8s cho Windows Key (Meta), 10.0s cho Generic Blur (Ân xá xử lý thanh công cụ).
      const bufferTime = (keyId === "meta_key") ? 800 : 10000;
      console.log(`🚨 [TakeExam] ${evt} detected (Buffering ${bufferTime}ms for smart amnesty...)`);
      
      window.__blurBufferTimer = setTimeout(() => {
        if (isCurrentlyExitedRef.current) {
          const durationMs = Date.now() - now; // Captured 'now' at start of onBlur
          console.log(`🚨 [TakeExam] ${evt} confirmed after ${durationMs}ms buffer. Reporting violation.`);
          
          if (!monitoringActiveRef.current) {
            flash(`⚠️ ${msg} (Giám sát hiện đang tắt)`, "warning", 4000);
          } else {
            // [Enforcement] Sau thời gian đệm, mọi lỗi rời đi đều là Vi phạm (+1 strike)
            penalize(evt, msg, keyId || "generic_blur", true, false, { duration_ms: durationMs });
          }
          window.__lastBlockKeyTimestamp = Date.now();
        }
      }, bufferTime);

      // [PROTECTION] Predictive black-out for mobile screenshot/exit
      if (isMobileDevice) {
        triggerScreenshotProtection();
      }

      // Cập nhật Sticky Keys
      altPressedRef.current = e?.altKey || false;
      metaPressedRef.current = (e?.metaKey || e?.osKey) || false;
      shiftPressedRef.current = e?.shiftKey || false;
      ctrlPressedRef.current = e?.ctrlKey || false;
    };

    // [Nuclear] Bắt Win+D / Thu nhỏ tức thì qua visibilitychange
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && metaPressedRef.current) {
        console.log("🚨 [TakeExam] Nuclear Win+D/Minimize detected via visibilitychange. Striking instantly.");
        const msg = getDynamicViolationReason("blocked_key", "meta+d", "Nhanh chóng thu nhỏ toàn bộ bài thi để về Màn hình chính (Win+D / Desktop).");
        penalize("blocked_key", msg, "meta+d", true, false);
        window.__lastBlockKeyTimestamp = Date.now();
      }
    };

    const onFocus = () => {
      // [Update] Tắt overlay sau 1 giây thay vì ngay lập tức để tránh đè nội dung đột ngột
      // Đặt lên trên cùng để tránh bị kẹt do Ghost Focus check
      setTimeout(() => setShowBlurOverlay(false), 1000);

      // 🕵️ [Nuclear Hardening] Chốt chặn Focus Ma (Ghost Focus)
      // Chỉ xác nhận quay lại nếu bài thi THỰC SỰ đang được hiển thị VÀ được tập trung
      if (document.visibilityState !== 'visible' || !document.hasFocus()) {
        console.log("ℹ️ [TakeExam] Ghost Focus detected. Ignoring return signals.");
        return; 
      }

      // 🏳️ Reset focus state - allow new strikes if they exit again
      isCurrentlyExitedRef.current = false;
      window.__lastFocusReturnTime = Date.now();
      
      notifyStudentReturned();

      // Check current potential violations for cleanup
      Object.keys(violationTimerRef.current).forEach(sid => {
        const timerId = violationTimerRef.current[sid];
        const verdict = aiVerdictRef.current[sid];

        if (verdict === false) {
          // AI said NO and we returned. Safe.
          console.log(`✅ [Focus] Returned < 5s and AI said NO. Deleting evidence for ${sid}`);
          clearTimeout(timerId);
          delete violationTimerRef.current[sid];
          try { axiosClient.delete(`/submissions/${submissionId}/proctor-event/${sid}`); } catch (e) { }
        }
      });

      const blurStart = lastViolationTimeRef.current["_blur_start"];
      if (blurStart) {
        const duration = Date.now() - blurStart;
        sessionEventsRef.current.push({
          event_type: "window_blur_duration",
          timestamp: Date.now(),
          details: { duration_ms: duration }
        });
        delete lastViolationTimeRef.current["_blur_start"];
      }
    };
    const onKey = (e) => {
      // Bỏ qua các sự kiện được giữ đè phím (Keyboard Auto-Repeat) để tránh đếm đúp
      if (e.repeat) return;

      // 🕵️ [Fix Sticky Keys] Luôn đồng bộ trạng thái phím từ chính đối tượng Event
      // Điều này ngăn chặn việc phím bị dính khi macro/window mất focus đột ngột
      altPressedRef.current = e.altKey || false;
      metaPressedRef.current = e.metaKey || false;
      shiftPressedRef.current = e.shiftKey || false;
      ctrlPressedRef.current = e.ctrlKey || false;
      // === Kiem tra chup man hinh truoc tien ===
      const SCREENSHOT_KEYS = [
        // PrtSc don
        { check: () => e.key === "PrintScreen" && !e.ctrlKey && !e.altKey, id: "printscreen" },
        // Ctrl+PrtSc (chup toan man hinh tren 1 so trinh duyet/ung dung)
        { check: () => (e.key === "PrintScreen" || e.keyCode === 44) && e.ctrlKey, id: "printscreen" },
        // Alt+PrtSc (chup cua so hien tai tren Windows)
        { check: () => (e.key === "PrintScreen" || e.keyCode === 44) && e.altKey, id: "alt+printscreen" },
        // Ctrl+Shift+S (shortcut chup man hinh tren 1 so app)
        { check: () => e.ctrlKey && e.shiftKey && ["s", "S"].includes(e.key), id: "meta+shift+s" },
        // Win+Shift+S (Snipping Tool)
        { check: () => e.metaKey && e.shiftKey && ["s", "S"].includes(e.key), id: "meta+shift+s" },
        // Mac screenshot (Cmd+Shift+3/4/5)
        { check: () => e.metaKey && e.shiftKey && ["3", "4", "5"].includes(e.key), id: "mac_screenshot" }
      ];

      for (const sk of SCREENSHOT_KEYS) {
        if (sk.check()) {
          e.preventDefault();
          e.stopPropagation();
          // Triệt tiêu phản lực (Snipping Tool làm Blur Window)
          window.__lastBlockKeyTimestamp = Date.now();
          // [Fix Screenshot] Assign the EXACT event type instead of blocked_key!
          penalize("screenshot_attempt", `Phát hiện cố tình chụp ảnh bài thi: ${sk.id}`, sk.id, true);
          // [PROTECTION] Nuclear blur/black-out to ruin the screenshot
          triggerScreenshotProtection();
          return;
        }
      }

      // === Cac phim chong gian lan thong thuong ===
      const blockKeys = ["Escape", "F11", "F5", "F12"];
      const combos = [
        {
          check: () => e.ctrlKey && ["r", "R"].includes(e.key),
          id: `F5`,
        },
        {
          check: () => e.ctrlKey && e.shiftKey && ["i", "I"].includes(e.key),
          id: `F12`,
        },
        {
          check: () => e.altKey && e.key === "Tab", id: "alt+tab"
        },
        { check: () => e.altKey && e.key === "F4", id: "alt+f4" },
        // Win+D: Thu nhỏ toàn bộ về Desktop
        { check: () => e.metaKey && ["d", "D"].includes(e.key), id: "meta+d" },
        // Win+P: Mở bảng chiếu màn hình phụ (Project)
        { check: () => e.metaKey && ["p", "P"].includes(e.key), id: "meta+p" },
      ];

      let matched = false;
      let keyId = e.key;
      if (blockKeys.includes(e.key)) matched = true;
      for (const c of combos) {
        if (c.check()) {
          matched = true;
          keyId = c.id;
          // Lưu lại combo Win cụ thể để onBlur phân biệt Win+D vs Win+P
          if (c.id.startsWith("meta+")) {
            window.__lastWinCombo = c.id;
          }
          break;
        }
      }

      if (!matched) return;

      // [Flexible Proctoring] Nếu tắt giám sát -> Không chặn phím (ngoại trừ Fullscreen thoát)
      if (!monitoringActiveRef.current && keyId !== "Escape" && keyId !== "F11") {
        console.log(`ℹ️ [Flexible] Monitoring off, allowing key: ${keyId}`);
        flash(`ℹ️ Bạn vừa nhấn phím ${keyId}. (Giám sát hiện đang tắt)`, "warning", 3000);
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // ĐẶT NGAY timestamp chốt chặn TRƯỚC MỌI THỨ (kể cả debounce)
      // để đảm bảo onFs/onBlur/onVis luôn bị triệt tiêu
      window.__lastBlockKeyTimestamp = Date.now();

      const now = Date.now();
      window.__keyPressTracker = window.__keyPressTracker || {};
      const lastPress = window.__keyPressTracker[keyId] || 0;

      // DEBOUNCE: Loại bỏ hoàn toàn nhiễu phần cứng (Key Chatter) 
      // hoặc lỗi browser dội 2 event liên tiếp dưới 300ms.
      if (lastPress > 0 && now - lastPress < 300) return;

      window.__keyPressTracker[keyId] = now;

      // Spam đúp cố ý (nhấn cái thứ 2 trong vòng 2s kể từ lần cảnh báo)
      const isFastRepeat = lastPress > 0 && (now - lastPress) < 2000;

      // [Warning Escalation] Theo dõi cảnh báo theo từng loại phím
      window.__warnedKeys = window.__warnedKeys || {};

      const isWarningKey = ["F11", "Escape", "copy_attempt", "F5", "F12"].includes(keyId);

      if (isWarningKey) {
        // [Refinement] Detect nuclear spam (Escape/F11) - 2 clicks < 2s
        const isNuclearSpam = ["Escape", "F11"].includes(keyId) && (lastPress > 0) && (now - lastPress < 2000);

        if (isNuclearSpam) {
            console.log(`🚨 [TakeExam] Nuclear SPAM detected for ${keyId}. Reporting to AI as strict.`);
            // [Force Restore] Ngay lập tức ép quay lại Fullscreen vì có gesture từ phím
            if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
            
            penalize("blocked_key", `Cố tình spam phím ${keyId} thoát bài thi liên tục.`, keyId, true, false);
            return;
        }

        // [Force Restore for 1st press]
        if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});

        // [New Authority] onKey reports all events to AI. Decision is delegated.
        const fallbackReason = isFastRepeat 
            ? `Cố tình nhấn phím ${keyId} liên tục để can thiệp hệ thống`
            : `Sử dụng phím bị chặn: ${keyId}`;
        const reason = getDynamicViolationReason("blocked_key", keyId, fallbackReason);
        
        penalize("blocked_key", reason, keyId, true, false);

        // Screenshot keys that might trigger onKey
        if (keyId === "PrintScreen") {
          // [Zero Tolerance] PrtSc is an instant +1 strike
          penalize("screenshot_attempt", "Nhấn phím PrintScreen chụp ảnh toàn màn hình đề thi.", "PrintScreen", true);
          triggerScreenshotProtection();
        } else if (keyId === "meta+shift+s") {
          // [Logic Snipping] Don't strike yet, wait for return to catch the selection
          window.__snippingDetected = true;
          triggerScreenshotProtection();
          console.log("📸 [TakeExam] Snipping Tool (Win+Shift+S) detected... awaiting return to strike.");
        } else if (keyId === "meta+d") {
          // [Authority] Striking instantly on keydown as requested by user
          penalize("blocked_key", "Nhanh chóng thu nhỏ toàn bộ bài thi để về Màn hình chính (Win+D / Desktop).", "meta+d", true);
          triggerScreenshotProtection();
        } else if (["meta+shift+q"].includes(keyId)) {
          triggerScreenshotProtection();
        }
      } else {
        // [Logic Fallback] Các phím cấm khác nhưng chưa gán rule đặc biệt
        const fallbackReason = `Sử dụng tổ hợp phím bị chặn: ${keyId}`;
        const reasonStr = getDynamicViolationReason("blocked_key", keyId, fallbackReason);
        penalize("blocked_key", reasonStr, keyId, true, false);
        flash(`🚨 VI PHẠM! ${reasonStr}`, "danger", 5000);
      }
    };
    const onCtx = (e) => e.preventDefault();
    const onBefore = (e) => {
      window.__isUnloadingApp = true;
      e.preventDefault();
      e.returnValue = "";
    };

    const onCopy = (e) => {
      try {
        const selection = window.getSelection().toString();
        if (selection) {
          const cleanSelection = selection.trim();
          lastInternalCopyContentRef.current = cleanSelection;
          localStorage.setItem('__oem_internal_copy', cleanSelection);
          console.log("📋 [Smart Clipboard] Đã ghi nhớ nội dung copy nội bộ.");
        }
      } catch (err) {}

      // KHÔNG e.preventDefault() để cho phép nội dung vào clipboard hệ thống (hỗ trợ dán nội bộ)
      // e.preventDefault();
      // 🕵️ Sync Sticky Keys
      altPressedRef.current = e.altKey || false;
      metaPressedRef.current = e.metaKey || false;

      // Chốt chặn blur/vis side-effects
      window.__lastBlockKeyTimestamp = Date.now();

      const now = Date.now();
      window.__keyPressTracker = window.__keyPressTracker || {};
      window.__warnedKeys = window.__warnedKeys || {};
      const lastPress = window.__keyPressTracker["copy_attempt"] || 0;

      // Khử nhiễu (Debounce)
      if (lastPress > 0 && now - lastPress < 300) return;

      window.__keyPressTracker["copy_attempt"] = now;

      // Nếu GIÁM SÁT ĐANG TẮT -> Cho phép thoải mái
      if (!monitoringActiveRef.current) {
        flash("ℹ️ [Nhắc nhở] Hành vi Sao chép dữ liệu bị hạn chế.", "warning", 2000);
        return;
      }

      // [Amnesty] Copy nội bộ không bị phạt và KHÔNG gửi lên server để tránh AI chốt nhầm
      console.log("ℹ️ [TakeExam] Copy nội bộ. Cho phép và bỏ qua ghi nhận vi phạm.");
      flash(`📋 Đã sao chép nội dung bài thi.`, "info", 2000);
      
      // Removed penalize call for internal context to prevent AI over-sensitivity
    };

    const onPaste = (e) => {
      // 🕵️ [Smart Clipboard] Kiểm tra nội dung dán
      try {
        const pastedText = (e.clipboardData.getData('text') || "").trim().toLowerCase();
        const internalText = (lastInternalCopyContentRef.current || localStorage.getItem('__oem_internal_copy') || "").trim().toLowerCase();
        
        const isInternal = pastedText && (pastedText === internalText);

        if (isInternal) {
          console.log("✅ [Smart Clipboard] Paste nội bộ hợp lệ. Cho phép (Silent).");
          // Reset timer để tránh onVis side-effects
          window.__lastBlockKeyTimestamp = Date.now();
          return; 
        }
      } catch (err) {}

      e.preventDefault();
      // 🕵️ Sync Sticky Keys
      altPressedRef.current = e.altKey || false;
      metaPressedRef.current = e.metaKey || false;

      // NẾU giám sát đang bật -> Tính lỗi. NẾU tắt thì cho phép.
      if (!monitoringActiveRef.current) {
        flash("ℹ️ Đã thực hiện thao tác Dán (Paste).", "warning", 2000);
        return;
      }
      
      const reason = getDynamicViolationReason("paste_attempt", null, "Thực hiện thao tác dán (Paste) nội dung từ nguồn bên ngoài.");
      penalize("paste_attempt", reason, "Ctrl+V", true, false, { is_internal: false });
      flash(`🚨 VI PHẠM! ${reason}`, "danger", 5000);
    };

    const onDrop = (e) => {
      e.preventDefault();
      // 🕵️ Sync Sticky Keys
      altPressedRef.current = e.altKey || false;
      metaPressedRef.current = e.metaKey || false;

      // [Zero Tolerance] Kéo thả văn bản là tính lỗi ngay lập tức
      penalize("drag_drop_in", getDynamicViolationReason("drag_drop_in", null, "Kéo thả văn bản/tài liệu từ cửa sổ bên ngoài vào ô trả lời bài thi."), "drag_drop", true);
    };

    const onDragOver = (e) => {
      e.preventDefault();
    };

    const onKeyUp = (e) => {
      const key = e.key;
      if (key === "Alt") altPressedRef.current = false;
      if (key === "Meta" || key === "OS") metaPressedRef.current = false;
      if (key === "Shift") shiftPressedRef.current = false;
      if (key === "Control") ctrlPressedRef.current = false;

      if (key === "PrintScreen") {
        console.log("📸 [TakeExam] PrintScreen nhả phím detected. Phạt lập tức.");
        penalize("screenshot_attempt", "Nhấn thả phím PrintScreen chụp ảnh đề thi.", "PrintScreen", true);
        triggerScreenshotProtection();
      }

      if (e.metaKey && e.shiftKey && (key === "s" || key === "S")) {
        console.log("📸 [TakeExam] Snipping Tool (Win+Shift+S) release detected. Phạt lập tức.");
        penalize("screenshot_attempt", "Hoàn tất tổ hợp phím Snipping Tool (Win+Shift+S).", "meta+shift+s", true);
        window.__snippingDetected = false; 
        triggerScreenshotProtection();
      }
    };

    const onScreenChange = (e) => {
      console.log("🖥️ [Screen] Configuration changed detected via onchange");
      try {
        if (window.screen && window.screen.isExtended) {
          penalize("multi_monitor_attempt", getDynamicViolationReason("multiple_screens_connected", null, "Phát hiện kết nối nhiều màn hình (Dual monitor)."), "extended_display", true, false);
        }
      } catch (err) { }
    };

    // ===== Mouse Outside Window Tracking =====
    const MOUSE_OUTSIDE_WARN_MS = 2500;  // 2.5 giây rời khỏi thì hiện Toast cảnh báo nhẹ
    const MOUSE_OUTSIDE_PENALIZE_MS = 4000; // 4 giây rời khỏi thì AI trừng phạt

    const onMouseLeave = (e) => {
      if (!monitoringActiveRef.current) return;

      const isTopEdge = e.clientY <= 15;
      const isBottomEdge = e.clientY >= window.innerHeight - 25;
      const xPos = e.clientX;
      const isCenter = xPos > window.innerWidth * 0.15 && xPos < window.innerWidth * 0.85;

      // BỎ QUA HOÀN TOÀN: NẾU là mép trên/dưới ở vùng trung tâm (Nơi thả thanh Stop Sharing)
      if ((isTopEdge || isBottomEdge) && isCenter) {
        console.log("ℹ️ [TakeExam] Chuột vào vùng Deadzone StopSharing. An toàn.");
        return; // Không đếm giờ phạt 
      }

      // Nếu chuột thực sự đi ra khỏi khung duyệt web (sang viền trái/phải hoặc đỉnh mà ko phải vùng an toàn)
      if (e.clientY <= 3 || e.clientX <= 3 || e.clientX >= window.innerWidth - 3 || e.clientY >= window.innerHeight - 3) {
        if (!mouseOutsideStartRef.current) {
          mouseOutsideStartRef.current = Date.now();
        }

        // Báo warning sau 3s
        if (!mouseOutsideTimerRef.current) {
          mouseOutsideTimerRef.current = setTimeout(() => {
            flash("⚠️ Chuột đang nằm ngoài khung bài thi! Đừng click bất cứ gì ngoài bài thi.", "warn", 3000);
          }, MOUSE_OUTSIDE_WARN_MS);
        }
      }
    };

    const onMouseEnter = () => {
      // Chuột quay vào, an toàn -> xóa mảng đếm giờ
      if (mouseOutsideTimerRef.current) {
        clearTimeout(mouseOutsideTimerRef.current);
        mouseOutsideTimerRef.current = null;
      }

      const start = mouseOutsideStartRef.current;
      if (start) {
        const duration = Date.now() - start;
        mouseOutsideStartRef.current = null;

        // Nếu ở ngoài > 8 giây = có khả năng nhìn tài liệu / điện thoại
        if (duration >= MOUSE_OUTSIDE_PENALIZE_MS) {
          mouseOutsideCountRef.current += 1;
          const secOut = Math.round(duration / 1000);
          penalize("mouse_outside", `Chuột rời khỏi vùng làm bài suốt ${secOut} giây - nghi ngờ thí sinh đang nhìn thiết bị khác hoặc tài liệu bên ngoài.`, "mouse", true, false);
        }
      }
    };

    start();
    // Kết nối tới WebSocket server để báo cáo gian lận - use SOCKET_URL from config
    const socketUrl = SOCKET_URL || window.location.origin;

    const socket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    // Khi kết nối thành công
    socket.on("connect", () => {
      console.log("✅ [Student] Connected to WebSocket");

      // Lấy thông tin sinh viên từ localStorage
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const savedFullName = localStorage.getItem("fullname");
      const studentName = user.full_name || savedFullName || `Student ${user.id || ''}`;

      // Đăng ký submission này với server
      socket.emit("student:register-submission", {
        submissionId: parseInt(submissionId),
        studentId: parseInt(user.id),
        examId: parseInt(examId),
        studentName,
      });
      console.log("📝 [Student] Registered submission with WebSocket");
    });

    // ===== Real-time Instructor Interventions =====
    
    // 1. Kicked by Instructor
    socket.on(`student:kicked:${submissionId}`, (data) => {
        console.log("🚨 [Socket] Kicked by instructor");
        flash(data.message || "Bạn đã bị giảng viên mời ra khỏi phòng thi.", "danger", 5000);
        handleSubmit('violation'); // Immediate submission
    });

    // 2. Exam Configuration Updated
    socket.on("exam:config-updated", (updates) => {
        console.log("🔄 [Socket] Exam config updated:", updates);
        flash("⚙️ Giảng viên vừa cập nhật cấu hình bài thi.", "success", 3000);
        
        if (updates.duration_minutes) {
            setDuration(updates.duration_minutes);
        }
        
        if (updates.time_close) {
            const closeTime = new Date(updates.time_close).getTime();
            if (!isNaN(closeTime)) {
                const now = Date.now();
                const secondsUntilClose = Math.floor((closeTime - now) / 1000);
                // Only update if it's a realistic update, avoid sudden close due to tiny sync diffs
                setRemaining(prev => {
                    const newRemaining = Math.max(0, secondsUntilClose);
                    // Nếu thời gian mới quá sát hoặc đã hết, chỉ set về 0 nếu thực sự cần thiết
                    return Math.min(prev, newRemaining);
                });
            }
        }
        
        if (updates.monitor_screen !== undefined) {
            monitorScreenConfigRef.current = !!updates.monitor_screen;
            setMonitoringActive(!!updates.monitor_screen);
            monitoringActiveRef.current = !!updates.monitor_screen;
        }
    });

    // 3. Exam Room Closed
    socket.on("exam:closed", (data) => {
        console.log("🔒 [Socket] Exam room closed");
        flash(data.message || "Phòng thi đã đóng.", "danger", 5000);
        handleSubmit('time'); // Force submit as if time ran out
    });

    // 4. Bypass Granted (Useful if student is stuck in PrepareExam but can also be used here)
    socket.on(`student:bypass-granted:${submissionId}`, () => {
        flash("✅ Bạn đã được giảng viên cho phép bỏ qua xác minh.", "success", 5000);
    });

    socket.on("disconnect", () => {
      console.log("❌ [Student] Disconnected from WebSocket");
    });

    // ==========================================
    // Real-time AI Behavior Analysis Interval
    // ==========================================
    const runAIAnalysis = async () => {
      if (submittedRef.current || !monitoringActiveRef.current) return;
      if (sessionEventsRef.current.length === 0) return; // No events to process

      // Throttle AI call 15 seconds max
      const now = Date.now();
      if (now - lastAIFireRef.current < 15000) return;
      lastAIFireRef.current = now;

      // Clone events to send and clear local buffer immediately
      const eventsToSend = [...sessionEventsRef.current];
      sessionEventsRef.current = [];

      try {
        const studentId = localStorage.getItem("student_id") || "0";
        const sysContext = await getSystemContext();
        const res = await axiosClient.post(`${AI_URL}/api/ai/detect-behavior`, {
          student_id: parseInt(studentId),
          exam_id: parseInt(examId),
          events: eventsToSend.map(e => ({ ...e, context: sysContext })),
          window_duration_seconds: 15
        }, { baseURL: "" });

          // [New Authority] AI confirm means violation. Period.
          if (res.data.confidence > 0.6) {
            // [New Logic] Skip strike if already in a recording session for the SAME behavior to avoid double counting
            if (recordingRef.current) {
               console.log(`ℹ️ [TakeExam] Prolonged absence detected but recording is active. Skipping duplicate strike for ${res.data.reason}`);
               return; 
            }

            // Use the specific rule key from AI instead of generic 'ai_detected_cheating'
            const aiEventType = res.data.rule_key || 'ai_detected_cheating';
            const msg = `[AI PHÊ DUYỆT] ${res.data.reason}`;
            flash(msg, "danger", 6000); 
            // Trigger authoritative violation (+1) with the EXACT AI REASON
            await commitViolation(aiEventType, null, msg, "ai_inference", true);
          }
      } catch (err) {
        console.warn("[AI] Failed to analyze behavior:", err.message);
      }
    };
    const activateMonitoring = setTimeout(() => {
      if (monitorScreenConfigRef.current) {
        monitoringActiveRef.current = true;
        setMonitoringActive(true); // Also update state for inactivity hook
        console.log("✅ [TakeExam] Monitoring activated after 10s grace period");
        // flash message đã được gọi sớm hơn lúc vừa chia sẻ màn hình xong
        try {
          sessionStorage.setItem("exam_monitoring_active", "1");
        } catch { }
      } else {
        console.log("ℹ️ [TakeExam] Monitoring disabled by instructor config");
      }
    }, 10000); // 10s grace period remains as requested

    // Bắt đầu interval gửi sự kiện cho AI phân tích
    aiCheckIntervalRef.current = setInterval(runAIAnalysis, 15000);

    window.addEventListener("keydown", onKey, true);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus); // For blur overlay protection
    window.addEventListener("contextmenu", onCtx);
    window.addEventListener("beforeunload", onBefore);
    window.addEventListener("keyup", onKeyUp, true);
    if (window.screen && window.screen.addEventListener) {
      window.screen.addEventListener("change", onScreenChange);
    }
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("drop", onDrop);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    const cleanup = () => {
      clearTimeout(activateMonitoring);
      if (aiCheckIntervalRef.current) clearInterval(aiCheckIntervalRef.current);
      monitoringActiveRef.current = false;
      setMonitoringActive(false); 
      try {
        sessionStorage.removeItem("exam_monitoring_active");
      } catch { }

      // ✅ Disconnect WebSocket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("beforeunload", onBefore);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("drop", onDrop);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      window.removeEventListener("keyup", onKeyUp, true);
      if (window.screen && window.screen.removeEventListener) {
        window.screen.removeEventListener("change", onScreenChange);
      }
      if (mouseOutsideTimerRef.current) clearTimeout(mouseOutsideTimerRef.current);
      if (aiCheckIntervalRef.current) clearInterval(aiCheckIntervalRef.current);
      if (mobileCheckInterval) clearInterval(mobileCheckInterval);
      if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
      stopSnapshotCapture();
      console.log(
        "🛑 [TakeExam] Monitoring stopped - all event listeners removed"
      );
    };

    cleanupListenersRef.current = cleanup;

    return cleanup;
  }, [submissionId, examId]);

  // ===== Timer =====
  useEffect(() => {
    if (remaining <= 0) {
      handleSubmit('time');
      return;
    }
    clearTimeout(tickRef.current);
    tickRef.current = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(tickRef.current);
  }, [remaining]);

  const fmt = useMemo(() => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [remaining]);

  const elapsedPercent = useMemo(() => {
    const total = duration * 60 || 1;
    const elapsed = Math.max(0, total - remaining);
    return Math.min(100, (elapsed / total) * 100);
  }, [remaining, duration]);

  // ===== Helpers =====
  const saveAnswer = async (q, value) => {
    try {
      const payload =
        q.type === "MCQ"
          ? {
            question_id: q.question_id,
            type: q.type,
            selected_option_id: value,
          }
          : { question_id: q.question_id, type: q.type, answer_text: value };
      await axiosClient.post(`/submissions/${submissionId}/answer`, payload);
      flash("Đã lưu câu trả lời", "warn", 900);
    } catch { }
  };


  const checkUnanswered = () => {
    const unanswered = questions.filter((q) => !q.__answered);
    return unanswered;
  };

  const handleSubmitClick = () => {
    // Kiểm tra câu bỏ trống
    const unanswered = checkUnanswered();
    setUnansweredQuestions(unanswered);
    setShowConfirmModal(true);
  };



  const counts = useMemo(
    () => ({
      total: questions.length,
      answered: questions.filter((q) => q.__answered).length,
    }),
    [questions]
  );

  const shellBg =
    theme === "dark"
      ? "bg-[radial-gradient(1200px_600px_at_15%_-10%,#1b2a52_0,transparent_60%),radial-gradient(1200px_800px_at_120%_10%,#1a1e3b_0,transparent_55%),linear-gradient(180deg,#070b14_0%,#0b1220_100%)]"
      : "bg-gradient-to-b from-white to-slate-100";

  const cardCls =
    theme === "dark"
      ? "bg-[#1e293b] border border-white/10 shadow-xl"
      : "bg-white border border-slate-200 shadow-md";

  const headerGrad =
    "bg-[linear-gradient(90deg,rgba(106,163,255,.15),rgba(34,225,255,.12),rgba(138,126,255,.15))] backdrop-saturate-150 backdrop-blur-md";

  if (monitorScreenConfigRef.current && !screenShared && !loading && !initError && !submitted && !isMobileDevice) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${shellBg}`}>
        {/* Required hidden elements - positioned off-screen so browser keeps rendering video frames */}
        <video ref={hiddenVideoRef} autoPlay playsInline muted style={{ position: 'fixed', left: '-9999px', top: 0, width: '1px', height: '1px' }} />
        <canvas ref={hiddenCanvasRef} style={{ position: 'fixed', left: '-9999px', top: 0, width: '1px', height: '1px' }} />

        <div className={`max-w-md w-full p-8 rounded-2xl text-center shadow-xl ${theme === 'dark' ? 'bg-[#0f172a] border border-slate-700' : 'bg-white border border-slate-200'}`}>
          <div className="text-6xl mb-6 flex justify-center">
            <div className="bg-blue-100 dark:bg-blue-900/40 w-24 h-24 rounded-full flex items-center justify-center">
              <span className="animate-pulse">🖥️</span>
            </div>
          </div>
          <h2 className={`text-2xl md:text-3xl font-extrabold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Bắt Buộc Chia Sẻ Màn Hình
          </h2>
          <p className={`mb-6 text-sm md:text-base leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700 font-semibold'}`}>
            Theo quy chế thi cử, bạn phải chia sẻ <strong className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>Toàn Màn Hình (Entire Screen)</strong> để tiếp tục vào bài thi. Nếu từ chối, bài thi sẽ không thể bắt đầu.
          </p>
          {screenShareError && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-semibold rounded-xl border border-red-200 dark:border-red-800">
              {screenShareError}
            </div>
          )}
          <button
            onClick={requestScreenShare}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold text-lg rounded-xl shadow-lg transition transform hover:scale-[1.02] active:scale-95"
          >
            Đồng Ý Chia Sẻ Màn Hình
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${shellBg} overflow-hidden`}>
      {/* Required hidden elements - positioned off-screen so browser keeps rendering video frames */}
      <video ref={hiddenVideoRef} autoPlay playsInline muted style={{ position: 'fixed', left: '-9999px', top: 0, width: '1px', height: '1px' }} />
      <canvas ref={hiddenCanvasRef} style={{ position: 'fixed', left: '-9999px', top: 0, width: '1px', height: '1px' }} />

      {/* HEADER */}
      <header
        className={`sticky top-0 z-40 border-b ${theme === "dark" ? "border-white/10" : "border-slate-200"
          } ${headerGrad}`}
      >
        <div className="relative max-w-none mx-auto px-2 md:px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 md:gap-3 min-w-0"
          >
            <img
              src="/Logo.png"
              alt="logo"
              className="h-7 md:h-9 w-auto rounded-lg shadow-lg ring-1 ring-white/20 bg-white flex-shrink-0"
            />
            <h1
              className={`text-xs md:text-sm font-semibold tracking-tight truncate ${theme === "dark" ? "text-slate-100" : "text-slate-800"
                }`}
            >
              {examTitle}
            </h1>
          </button>
          
          {/* CENTERED TIMER */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 font-mono font-black text-xl md:text-3xl whitespace-nowrap z-50 transition-colors ${
              theme === "dark" ? "text-blue-400" : "text-blue-600"
            }`}
          >
            {fmt}
          </div>


          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            {/* Mobile Nav Toggle */}
            <button
              onClick={() => setShowMobileNav(!showMobileNav)}
              className={`lg:hidden px-3 py-1.5 rounded-lg border text-sm
                ${theme === 'dark' ? 'bg-white/10 border-white/20 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}
              `}
            >
              ☰ Map
            </button>
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-lg border text-sm md:text-base ${theme === "dark"
                ? "bg-white/10 border-white/20 text-slate-100"
                : "bg-white border-slate-200 text-slate-800"
                }`}
              title="Đổi giao diện Sáng/Tối"
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>

            <button
              onClick={handleSubmitClick}
              disabled={submitting}
              className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-white text-xs md:text-base font-bold shadow-lg disabled:opacity-60 whitespace-nowrap"
              style={{ background: "#10b981" }}
            >
              {submitting ? "Đang nộp..." : "Nộp bài"}
            </button>
          </div>
        </div>

        {/* BLUE PROGRESS BAR on header */}
        <div
          className={`${theme === "dark" ? "bg-white/10" : "bg-slate-200"
            } h-1 w-full`}
        >
          <div
            className="h-1 bg-emerald-500 transition-all"
            style={{ width: `${elapsedPercent}%` }}
          />
        </div>
      </header>

      {/* BODY (only MAIN scrolls) */}
      <div className="flex-1 overflow-hidden flex">
        <div
          className="max-w-none mx-auto px-1 md:px-2 py-2 flex gap-2 md:gap-4 w-full"
          style={{ height: "calc(100vh - 80px)" }}
        >
          {/* SIDEBAR (fixed position, no scroll) - Ẩn trên mobile */}
          <aside
            className={`hidden lg:flex rounded-none p-4 ${cardCls} flex-shrink-0 w-64 flex-col h-full`}
          >
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <h3
                className={`text-sm font-semibold ${theme === "dark" ? "text-slate-100" : "text-slate-800"
                  }`}
              >
                Câu hỏi
              </h3>
              <span
                className={`${theme === "dark" ? "text-slate-400" : "text-slate-500"
                  } text-xs`}
              >
                {counts.answered}/{counts.total} đã làm
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pointer-events-auto select-none overflow-y-auto max-h-[calc(100%-140px)] pr-1">
              {questions.map((q, i) => (
                <button
                  key={q.question_id}
                  title={`Câu ${i + 1}`}
                  onClick={() => scrollTo(q.question_id)}
                  className={`h-11 w-11 rounded-xl border-2 text-sm font-bold transition-all shadow-sm flex items-center justify-center
                  ${q.__answered
                      ? "bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/10"
                      : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                    }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="mt-3 p-4 rounded-2xl bg-amber-50 dark:bg-yellow-900/30 border-2 border-amber-200 dark:border-yellow-800 shadow-sm">
              <p
                className={`${theme === "dark" ? "text-yellow-300" : "text-amber-950"
                  } text-xs font-black flex items-center gap-1.5 mb-1`}
              >
                <span>⚠️</span>
                <span>Hệ thống giám sát đang hoạt động</span>
              </p>
              <p
                className={`${theme === "dark" ? "text-yellow-400/80" : "text-amber-900/70"
                  } text-[11px] leading-relaxed font-bold`}
              >
                Giữ toàn màn hình. Rời tab/ESC/F11 sẽ bị cảnh cáo.
              </p>
              <div className="my-2.5 h-[1.5px] bg-amber-200 dark:bg-yellow-800/40" />
              {violations > 0 && (
                <div className="space-y-1">
                  <p className="text-red-700 dark:text-red-400 text-xs font-black flex items-center gap-1.5">
                    <span className="text-sm">🚨</span> Vi phạm: {violations}/10
                  </p>
                  <p className="text-red-600 dark:text-red-300 text-[10px] font-black uppercase tracking-wider">
                    LƯU Ý TUÂN THỦ QUY ĐỊNH THI
                  </p>
                </div>
              )}
            </div>
          </aside>

          {/* MAIN (scrollable) */}
          <main className="flex-1 space-y-4 overflow-y-auto pr-1 h-full">
            {initError ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="text-4xl mb-4">⚠️</div>
                <p className={`${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'} mb-6 max-w-md`}>
                  {initError}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg transition"
                  >
                    Thử lại
                  </button>
                  <button
                    onClick={() => navigate("/verify-room")}
                    className={`px-5 py-2.5 border font-semibold rounded-xl transition
                      ${theme === 'dark'
                        ? 'border-white/20 hover:bg-white/10 text-slate-300'
                        : 'border-slate-300 hover:bg-slate-50 text-slate-700'
                      }`}
                  >
                    Về xác minh
                  </button>
                </div>
              </div>
            ) : loading ? (
              <div className="space-y-3">
                <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
                <div className="h-24 w-full rounded bg-slate-200 animate-pulse" />
                <div className="h-24 w-full rounded bg-slate-200 animate-pulse" />
              </div>
            ) : (
              questions.map((q, idx) => (
                <section
                  key={q.question_id}
                  ref={(el) => (qRefs.current[q.question_id] = el)}
                  className={`notranslate rounded-none p-4 md:p-6 mb-4 ${cardCls} shadow-sm border border-slate-200 dark:border-white/10`}
                  translate="no"
                >
                  {/* Header: Compact Question Number & Meta */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-md">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600">Câu hỏi {idx + 1}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${theme === 'dark'
                            ? 'bg-blue-950/40 border-blue-800/50 text-blue-300'
                            : 'bg-blue-50 border-blue-200 text-blue-700'
                          }`}>
                          {q.type === "MCQ" ? "Trắc nghiệm" : "Tự luận"}
                        </span>
                        <span className="w-1 h-1 bg-gray-300 dark:bg-white/10 rounded-full" />
                        <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 tracking-tight">{q.points || 1} Điểm </span>
                      </div>
                    </div>
                  </div>

                  {/* Question Text: Bold & High Contrast */}
                  <div className={`text-lg md:text-2xl font-bold leading-relaxed mb-6 whitespace-pre-wrap ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                    {q.question_text.replace(/^(?:Câu|Question)?\s*\d+[:.:]?\s*/i, "")}
                  </div>

                  {/* Answer Section: Compact & Vertical */}
                  <div className="pt-2">
                    {q.type === "MCQ" ? (
                      <div className="flex flex-col gap-3">
                        {(q.options || []).map((o, oIdx) => {
                          const oid = o.option_id ?? o.id;
                          const isSelected = q.__selected === oid;
                          const label = String.fromCharCode(65 + oIdx); // A, B, C, D
                          return (
                            <label
                              key={oid}
                              className={`group relative flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                                  ? "bg-blue-600/10 border-blue-600 shadow-sm"
                                  : theme === 'dark'
                                    ? "bg-white/5 border-white/5 hover:border-white/20"
                                    : "bg-slate-50 border-slate-100 hover:border-blue-400 hover:bg-slate-100"
                                }`}
                            >
                              <input
                                type="radio"
                                className="hidden"
                                checked={isSelected}
                                onChange={() => {
                                  saveAnswer(q, oid);
                                  setQuestions((prev) =>
                                    prev.map((qq) =>
                                      qq.question_id === q.question_id
                                        ? { ...qq, __answered: true, __selected: oid }
                                        : qq
                                    )
                                  );
                                }}
                              />
                              {/* Label Badge (A, B, C, D) */}
                              <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-black text-sm transition-colors border ${isSelected
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white dark:bg-white/10 border-slate-200 dark:border-white/20 text-slate-500 dark:text-slate-300"
                                }`}>
                                {label}
                              </div>
                              {/* Option Text */}
                              <span className={`flex-1 text-base leading-snug ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'} ${isSelected ? "font-bold text-blue-600" : "font-medium"}`}>
                                {o.option_text ?? o.text}
                              </span>
                              {/* Selection Indicator */}
                              {isSelected && (
                                <div className="p-1.5 bg-blue-600 rounded-full text-white shadow-lg shadow-blue-600/20">
                                  <Check className="w-3.5 h-3.5 font-bold" strokeWidth={4} />
                                </div>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="relative">
                        <textarea
                          rows={5}
                          value={q.__answer_text || ""}
                          placeholder="Nhập câu trả lời tự luận của bạn tại đây..."
                          className={`w-full p-6 rounded-xl border-2 outline-none font-medium text-lg leading-relaxed transition-all resize-y min-h-[150px] ${theme === 'dark'
                              ? "bg-white/5 border-white/10 focus:border-blue-600 text-slate-100"
                              : "bg-white border-slate-100 focus:border-blue-600 text-slate-900 shadow-inner"
                            }`}
                          spellCheck="false"
                          data-gramm="false"
                          onChange={(e) => {
                            const v = e.target.value;
                            clearTimeout(window.__deb?.[q.question_id]);
                            window.__deb = window.__deb || {};
                            window.__deb[q.question_id] = setTimeout(() => saveAnswer(q, v), 700);
                            setQuestions((prev) =>
                              prev.map((qq) =>
                                qq.question_id === q.question_id
                                  ? { ...qq, __answered: v && v.trim().length > 0, __answer_text: v }
                                  : qq
                              )
                            );
                          }}
                        />
                        <div className="absolute right-4 bottom-4 flex items-center gap-2 opacity-30 pointer-events-none">
                          <span className="text-[10px] font-black uppercase tracking-widest italic animate-pulse">Auto-saving...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              ))
            )}
          </main>
        </div>
      </div>

      {/* TOAST */}
      {!!toast.msg && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 bottom-3 md:bottom-6 z-50 font-bold px-3 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl shadow-2xl max-w-[95vw] md:max-w-md w-full mx-2
            ${toast.kind === "danger"
              ? "bg-red-500 text-white border-2 border-red-700"
              : toast.kind === "warn"
                ? "bg-yellow-300 text-slate-900"
                : "bg-white text-slate-900"
            }`}
        >
          <div className="flex items-center gap-2 md:gap-3">
            {toast.kind === "danger" && violations > 0 && (
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0 animate-bounce">
                <span className="text-red-600 text-lg md:text-xl font-bold">
                  {violations}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm leading-tight break-words">
                {toast.msg}
              </p>
              {toast.kind === "danger" && (
                <p className="text-[10px] md:text-xs mt-1 opacity-80">
                  Cảnh báo này sẽ tự động tắt sau 10 giây
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      <div
        className={`fixed inset-0 z-50 ${showModal ? "grid" : "hidden"
          } place-items-center bg-black/50 p-4`}
      >
        <div
          className={`w-full max-w-[560px] p-4 md:p-6 rounded-2xl border border-slate-200 shadow-2xl text-slate-800 bg-white`}
          style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
        >
          <h2 className={`text-base md:text-lg font-bold mb-2 ${(submitReason === 'time' || submitReason === 'violation') ? "text-red-600" : ""}`}>
            {submitReason === 'time' && "⏰ Đã hết giờ làm bài!"}
            {submitReason === 'violation' && "🚨 Tự động nộp bài do vi phạm!"}
            {submitReason === 'manual' && "Kết quả tạm thời"}
          </h2>
          {submitReason === 'time' && (
            <p className="text-sm text-slate-600 mb-4 font-medium">
              Hệ thống đã tự động thu bài và chấm điểm các câu bạn đã làm.
            </p>
          )}
          {submitReason === 'violation' && (
            <p className="text-sm text-slate-600 mb-4 font-medium">
              Hệ thống đã tự động nộp bài vì sinh viên vi phạm quy chế thi quá 50 lần.
            </p>
          )}
          <div
            className={`flex items-center justify-between py-2 border-b text-sm md:text-base ${theme === "dark"
              ? "border-white/10"
              : "border-dashed border-slate-300"
              }`}
          >
            <div>Điểm trắc nghiệm (MCQ)</div>
            <strong>
              {mcqScore != null ? Number(mcqScore).toFixed(1) : "-"}/10
            </strong>
          </div>
          <div
            className={`flex items-center justify-between py-2 border-b text-sm md:text-base ${theme === "dark"
              ? "border-white/10"
              : "border-dashed border-slate-300"
              }`}
          >
            <div>Điểm tự luận (AI)</div>
            <strong>
              {aiScore != null ? Number(aiScore).toFixed(1) : "—"}/10
            </strong>
          </div>
          <div className="flex items-center justify-between py-2 text-sm md:text-base">
            <div>Tổng tạm</div>
            <strong>
              {totalScore != null
                ? Number(totalScore).toFixed(1)
                : mcqScore != null
                  ? Number(mcqScore).toFixed(1)
                  : "-"}
              /10
            </strong>
          </div>
          <div
            className={`${theme === "dark" ? "text-slate-300" : "text-slate-600"
              } text-xs md:text-sm mt-1`}
          >
            Điểm tự luận sẽ được AI & giảng viên xác nhận sau.
          </div>

          <button
            className="w-full mt-4 text-white text-sm md:text-base font-extrabold tracking-wide rounded-xl py-2.5 md:py-3 shadow-lg"
            style={{ background: "#4f46e5" }}
            onClick={() => {
              setShowModal(false);
              navigate("/student-dashboard", { replace: true });
            }}
          >
            Về trang chủ
          </button>
        </div>
      </div>

      {/* MODAL XÁC NHẬN NỘP BÀI */}
      <div
        className={`fixed inset-0 z-50 ${showConfirmModal ? "grid" : "hidden"
          } place-items-center bg-black/60 backdrop-blur-sm p-4`}
      >
        <div
          className="w-full max-w-[520px] p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-2xl bg-white max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
        >
          {unansweredQuestions.length > 0 ? (
            <>
              <div className="flex items-start gap-2 md:gap-3 mb-3 md:mb-4">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl md:text-2xl">⚠️</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-base md:text-lg font-bold text-slate-800">
                    Cảnh báo: Có câu hỏi bỏ trống
                  </h2>
                  <p className="text-xs md:text-sm text-slate-600 mt-1">
                    Bạn đang bỏ trống{" "}
                    <strong className="text-red-600">
                      {unansweredQuestions.length} câu hỏi
                    </strong>
                    :
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-2 md:p-3 mb-3 md:mb-4 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {unansweredQuestions.map((q, idx) => {
                    const qIndex =
                      questions.findIndex(
                        (qq) => qq.question_id === q.question_id
                      ) + 1;
                    return (
                      <button
                        key={q.question_id}
                        onClick={() => {
                          scrollTo(q.question_id);
                          setShowConfirmModal(false);
                        }}
                        className="px-2 md:px-3 py-1 bg-red-100 border border-red-300 rounded-lg text-red-700 font-semibold text-xs md:text-sm hover:bg-red-200 transition"
                      >
                        Câu {qIndex}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs md:text-sm text-slate-700 mb-3 md:mb-4">
                Bạn có muốn tiếp tục nộp bài không? Các câu bỏ trống sẽ không
                được tính điểm.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl border-2 border-slate-300 text-slate-700 text-sm md:text-base font-bold hover:bg-slate-50 transition"
                >
                  Quay lại làm tiếp
                </button>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    handleSubmit('manual');
                  }}
                  disabled={submitting}
                  className="flex-1 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl text-white text-sm md:text-base font-bold shadow-lg disabled:opacity-60 transition"
                  style={{
                    background: "#ef4444",
                  }}
                >
                  Bỏ qua và nộp bài
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 md:gap-3 mb-3 md:mb-4">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl md:text-2xl">✋</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-base md:text-lg font-bold text-slate-800">
                    Xác nhận nộp bài
                  </h2>
                  <p className="text-xs md:text-sm text-slate-600 mt-1">
                    Bạn đã hoàn thành{" "}
                    <strong className="text-green-600">
                      {counts.answered}/{counts.total} câu hỏi
                    </strong>
                    .
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-2 md:p-3 mb-3 md:mb-4">
                <p className="text-xs md:text-sm text-slate-700">
                  ⏰ Thời gian còn lại:{" "}
                  <strong className="text-blue-600 font-mono">{fmt}</strong>
                </p>
                <p className="text-xs md:text-sm text-slate-600 mt-2">
                  Sau khi nộp bài, bạn sẽ không thể chỉnh sửa câu trả lời.
                </p>
              </div>

              <p className="text-sm md:text-base text-slate-800 font-semibold mb-3 md:mb-4">
                Bạn có chắc chắn muốn nộp bài không?
              </p>

              <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl border-2 border-slate-300 text-slate-700 text-sm md:text-base font-bold hover:bg-slate-50 transition"
                >
                  Quay lại làm tiếp
                </button>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    handleSubmit('manual');
                  }}
                  disabled={submitting}
                  className="flex-1 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl text-white text-sm md:text-base font-bold shadow-lg disabled:opacity-60 transition"
                  style={{
                    background: "#10b981",
                  }}
                >
                  {submitting ? "Đang nộp..." : "Xác nhận nộp bài"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MOBILE NAV DRAWER */}
      {showMobileNav && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowMobileNav(false)}
          />

          {/* Drawer Content */}
          <div className={`relative w-64 h-full flex flex-col p-4 shadow-2xl ${cardCls} bg-[#0f172a]`} style={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff' }}>
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                Danh sách câu hỏi
              </h3>
              <button
                onClick={() => setShowMobileNav(false)}
                className={`p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 overflow-y-auto flex-1 content-start mb-2">
              {questions.map((q, i) => (
                <button
                  key={q.question_id}
                  onClick={() => {
                    scrollTo(q.question_id);
                    setShowMobileNav(false);
                  }}
                  className={`h-10 rounded-xl border text-sm font-semibold transition flex items-center justify-center
                  ${q.__answered
                      ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-600 dark:text-emerald-400"
                      : "bg-indigo-500/10 border-indigo-400/30 text-indigo-600 dark:text-indigo-400"
                    }
                  `}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <div className="mt-auto p-2 rounded-xl bg-orange-50 dark:bg-yellow-900/40 border border-orange-200 dark:border-yellow-700">
              <p className="text-yellow-700 dark:text-yellow-300 text-xs font-semibold mb-1">
                ⚠️ Giám sát đang bật
              </p>
              {violations > 0 && (
                <p className="text-red-600 dark:text-red-400 text-xs font-bold">
                  Vi phạm: {violations}/50
                </p>
              )}
            </div>
          </div>
        </div>
      )}


      {/* BLUR OVERLAY - Nhắc nhở SV quay lại - Làm mờ cực mạnh để không đọc được nội dung */}
      {showBlurOverlay && !submitted && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.1)' }}
        >
          <div className="text-center bg-black/60 rounded-2xl px-8 py-6 backdrop-blur-2xl border border-white/10 pointer-events-none shadow-2xl">
            <div className="text-5xl mb-3">🔒</div>
            <h2 className="text-xl font-bold text-white">Vui lòng quay lại bài thi</h2>
            <p className="text-white/60 text-sm mt-2">Dữ liệu đang được bảo vệ...</p>
          </div>
        </div>
      )}

      {/* SCREENSHOT PROTECTION - Nuclear Option (3s Black/Blur) */}
      {showScreenshotProtection && !submitted && (
        <div className="fixed inset-0 z-[500] bg-black flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-red-600 rounded-full flex items-center justify-center animate-ping">
              <ShieldAlert className="text-white w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white">PHÁT HIỆN CHỤP MÀN HÌNH!</h2>
            <p className="text-red-400 mt-2">Nội dung đã được mã hóa và bảo vệ.</p>
          </div>
        </div>
      )}

      {/* FULLSCREEN OVERLAY - Bắt buộc quay lại toàn màn hình */}
      {showFullscreenOverlay && !submitted && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            {/* Icon */}
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
              <span className="text-5xl">⚠️</span>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-white mb-4">
              Đã Thoát Toàn Màn Hình!
            </h2>

            {/* Message */}
            <p className="text-slate-300 mb-6">
              Bạn phải quay lại chế độ toàn màn hình để tiếp tục làm bài.
              Nhấn nút bên dưới để tiếp tục.
            </p>

            {/* Warning */}
            <div className="bg-red-900/50 border border-red-500/50 rounded-xl p-4 mb-6">
              <p className="text-red-300 text-sm">
                <strong>⚠️ Lưu ý:</strong> Việc thoát toàn màn hình nhiều lần sẽ bị tính là vi phạm quy chế thi.
              </p>
            </div>

            {/* Button */}
            <button
              onClick={async () => {
                try {
                  await document.documentElement.requestFullscreen();
                  setShowFullscreenOverlay(false);
                } catch (err) {
                  console.error("Cannot enter fullscreen:", err);
                  // Vẫn thử ẩn overlay nếu đã ở fullscreen
                  if (document.fullscreenElement) {
                    setShowFullscreenOverlay(false);
                  }
                }
              }}
              className="w-full px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold text-lg rounded-xl shadow-lg transition transform hover:scale-105 active:scale-95"
            >
              🖥️ Quay Lại Toàn Màn Hình
            </button>

            <p className="text-slate-500 text-xs mt-4">
              Số vi phạm hiện tại: {violations}/50
            </p>
          </div>
        </div>
      )}

      {/* 📱 Android Permission Fix Button */}
      {isAndroid && !screenShared && !loading && !submitted && (
        <div className="fixed bottom-24 left-4 right-4 z-[60] animate-bounce">
          <button
            onClick={() => requestScreenShare()}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-[0_8px_30px_rgb(249,115,22,0.4)] flex items-center justify-center gap-3 border-2 border-white/20"
          >
            <span className="text-2xl">⚡</span>
            BẮT ĐẦU CHIA SẺ MÀN HÌNH (ANDROID)
          </button>
        </div>
      )}

    </div>
  );
}
