import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { SOCKET_URL } from "../../api/config";
import io from "socket.io-client";
import { useInactivityMonitor } from "../../hooks/useInactivityMonitor";

export default function TakeExam() {
  const { examId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const submissionId = search.get("submission_id");

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

  // ===== State =====
  const [theme, setTheme] = useState(
    () => localStorage.getItem("examTheme") || "dark"
  ); // 'dark' | 'light'
  const [initError, setInitError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [examTitle, setExamTitle] = useState("Bài thi – Demo UI");
  const [duration, setDuration] = useState(
    Number(sessionStorage.getItem("pending_exam_duration") || "60")
  );
  const [remaining, setRemaining] = useState(duration * 60);
  const [questions, setQuestions] = useState([]);
  const [violations, setViolations] = useState(0);
  const [toast, setToast] = useState({ msg: "", kind: "" }); // '', 'warn', 'danger'
  const [showModal, setShowModal] = useState(false);
  const [mcqScore, setMcqScore] = useState(0);
  const [aiScore, setAiScore] = useState(null);
  const [totalScore, setTotalScore] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false); // Đánh dấu đã nộp bài
  const [showConfirmModal, setShowConfirmModal] = useState(false); // Modal xác nhận nộp bài
  const [unansweredQuestions, setUnansweredQuestions] = useState([]); // Danh sách câu bỏ trống
  const [isTimeUp, setIsTimeUp] = useState(false); // Danh sách câu bỏ trống
  const [showMobileNav, setShowMobileNav] = useState(false); // Mobile drawer state
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false); // Overlay bắt buộc vào lại fullscreen
  const [monitoringActive, setMonitoringActive] = useState(false); // State for inactivity hook (not ref)
  const [showBlurOverlay, setShowBlurOverlay] = useState(false); // Blur overlay for screenshot protection

  // ===== AI / Real-time Events Refs =====
  const sessionEventsRef = useRef([]); // Thu thập events cho AI
  const aiCheckIntervalRef = useRef(null); // Interval Timer
  const lastAIFireRef = useRef(0); // Chống spam AI
  const AI_URL = import.meta.env.VITE_AI_SERVER_URL || "http://localhost:8000";

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

  const [screenShared, setScreenShared] = useState(false);
  const [screenShareError, setScreenShareError] = useState(null);

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

      // Listen for user stopping sharing manually via browser bar
      track.onended = () => {
        setScreenShared(false);
        setScreenShareError("Bạn đã tắt chia sẻ màn hình. Vui lòng tải lại trang và bật lại để tiếp tục bài thi.");
        // Try to penalize them if they stop it mid-exam
        if (!submittedRef.current) {
          penalize("screen_share_stopped", "Sinh viên tự ý tắt chia sẻ màn hình");
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
      }).catch(err => console.error("Failed to upload snapshots", err));
    }
  };

  const startSnapshotCapture = (snapshotId = null) => {
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



  const notifyStudentReturned = () => {
    if (!recordingRef.current) return;
    console.log("[Recording] Student returned. Waiting 10s before stopping capture...");

    // Clear any existing wait timer
    clearTimeout(returnTimerRef.current);

    // Wait 10 seconds of "good behavior" before stopping
    returnTimerRef.current = setTimeout(() => {
      console.log("[Recording] 10s elapsed with normal behavior. Stopping capture.");
      stopSnapshotCapture();
    }, 10000);
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
      const newCount = currentCount + 1;

      // If this is the 5th violation, trigger auto-submit
      if (newCount >= 5 && !submittedRef.current) {
        submittedRef.current = true; // Prevent further processing

        // Auto-submit exam via API
        setTimeout(async () => {
          try {
            setToast({ msg: "⚠️ Quá 5 lần vi phạm - Bài thi tự động nộp!", kind: "danger" });
            setSubmitting(true);
            setSubmitted(true);

            // Stop all monitoring
            if (cleanupListenersRef.current) {
              cleanupListenersRef.current();
              cleanupListenersRef.current = null;
            }

            // Call submit API
            const res = await axiosClient.post(`/submissions/${submissionId}/submit`);
            const beMcq = typeof res.data?.total_score === "number" ? res.data.total_score : null;
            const beAi = res.data?.ai_score ?? null;
            const beSum = res.data?.suggested_total_score ?? null;
            if (beMcq != null) setMcqScore(beMcq);
            if (beAi != null) setAiScore(beAi);
            if (beSum != null) setTotalScore(beSum);

            setShowModal(true);
            sessionStorage.removeItem("pending_exam_duration");
            sessionStorage.removeItem("exam_flags");
            sessionStorage.removeItem(`exam_${examId}_started`);
            localStorage.removeItem("examTheme");

            try { await document.exitFullscreen?.(); } catch { }
          } catch (err) {
            console.error("❌ [Auto-submit] Error:", err);
            setShowModal(true);
          } finally {
            setSubmitting(false);
          }
        }, 100);
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

    const flash = (msg, kind = "warn", ms = 1200) => {
      setToast({ msg, kind });
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(
        () => setToast({ msg: "", kind: "" }),
        ms
      );
    };

    const penalize = (evt, msg, key = null) => {
      if (window.__isUnloadingApp) return;
      if (submittedRef.current) {
        console.log(
          "🛑 [TakeExam] Violation ignored - exam already submitted:",
          evt
        );
        return;
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

      // Group focus/visibility/fullscreen events to prevent triple counting on mobile (blur + hidden + resize/fs)
      const SHARED_FOCUS_EVENTS = ["visibility_hidden", "window_blur", "fullscreen_lost", "split_screen"];

      const now = Date.now();

      // 1. Individual event throttling (1s)
      const lastTime = lastViolationTimeRef.current[evt];
      if (lastTime !== undefined && now - lastTime < 1000) {
        console.log(
          `⏸️ [TakeExam] Violation throttled (${evt}), last report: ${now - lastTime}ms ago`
        );
        return;
      }

      // 2. Shared group throttling (3s) - Only for focus events
      if (SHARED_FOCUS_EVENTS.includes(evt)) {
        const lastShared = lastViolationTimeRef.current["_last_shared_focus_loss"];
        if (lastShared !== undefined && now - lastShared < 3000) {
          console.log(
            `⏸️ [TakeExam] Shared focus violation skipped (${evt}), last shared group report: ${now - lastShared}ms ago`
          );
          return;
        }
        // Update shared timestamp only if we are actually proceeding to penalize
        lastViolationTimeRef.current["_last_shared_focus_loss"] = now;
      }

      lastViolationTimeRef.current[evt] = now;

      // Generare snapshot_id to tie frames to this specific DB log
      const snapshotId = `V_${Date.now()}_${evt}`;

      // Push to AI local cache (Debounced to prevent spam for the same action)
      if (evt !== 'ai_detected_cheating') {
        const lastSimilarEvent = sessionEventsRef.current.find(e => e.event_type === evt);
        if (!lastSimilarEvent || now - lastSimilarEvent.timestamp > 2000) {
          sessionEventsRef.current.push({
            event_type: evt,
            timestamp: now,
            details: { message: msg, key }
          });
        }
      }

      // Report to backend (non-blocking)
      try {
        postProctor(evt, { message: msg, key, snapshot_id: snapshotId });
      } catch (e) { }

      // Trigger AI behavior evaluation and 3fps screenshot recording
      startSnapshotCapture(snapshotId);

      // Update local violation count and notify student
      setViolations((v) => {
        const nv = v + 1;
        if (nv >= 5) {
          flash(`🚨 Vi phạm: ${nv}/5 — Hệ thống sẽ tự động nộp bài nếu tiếp tục vi phạm.`, "danger", 8000);
          // Attempt auto-submit (best-effort)
          try {
            handleSubmit(true);
          } catch (e) { }
        } else if (nv >= 3) {
          flash(`❌ Vi phạm: ${nv}/5 — Cảnh báo nghiêm trọng`, "danger", 6000);
        } else {
          flash(`❌ Vi phạm: ${nv}/5`, "danger", 4000);
        }
        return nv;
      });

      // done
    };

    // Check if mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Mobile specific: Split screen / PIP detection
    const checkMobileIntegrity = () => {
      if (!isMobile) return;

      // Skip check if user is typing (virtual keyboard shrinks viewport)
      const ae = document.activeElement;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) {
        return;
      }

      // Check for split screen (width significantly smaller than screen width)
      // Tolerance: < 90% of screen width
      const screenW = window.screen.width;
      const windowW = window.innerWidth;

      if (windowW < screenW * 0.9) {
        penalize("split_screen", "Phát hiện chia đôi màn hình / Cửa sổ thu nhỏ");
      }
    };

    const mobileCheckInterval = isMobile ? setInterval(checkMobileIntegrity, 3000) : null;

    // Fullscreenchange handler (separate from penalize)
    const onFs = () => {
      if (!document.fullscreenElement) {
        const now = Date.now();
        const fe = fullscreenExitCountsRef.current || { count: 0, last: 0, timeout: null };

        // Reset if last exit was long ago
        if (now - fe.last > 3000) fe.count = 0;
        fe.count += 1;
        fe.last = now;

        // Clear previous reset timer
        if (fe.timeout) clearTimeout(fe.timeout);
        fe.timeout = setTimeout(() => {
          fullscreenExitCountsRef.current = { count: 0, last: 0, timeout: null };
        }, 3000);

        fullscreenExitCountsRef.current = fe;

        // Luôn hiển thị overlay ngay lập tức khi thoát fullscreen
        setShowFullscreenOverlay(true);

        if (fe.count === 1) {
          // First fullscreen exit: warning only, try to recover but do not penalize
          flash("⚠️ Thoát toàn màn hình! Nhấn nút bên dưới để quay lại.", "warn", 5000);

          // Thử tự động vào lại fullscreen
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen()
              .then(() => {
                // Vào lại thành công -> ẩn overlay
                setShowFullscreenOverlay(false);
              })
              .catch((err) => {
                console.log("ℹ️ [TakeExam] Cannot re-enter fullscreen (first exit):", err?.message || err);
                // Giữ overlay để người dùng nhấn nút
              });
          }
          return;
        }

        // Second (or more) fullscreen exit within window -> count as violation
        // Reset counter
        if (fe.timeout) {
          clearTimeout(fe.timeout);
          fe.timeout = null;
        }
        fullscreenExitCountsRef.current = { count: 0, last: 0, timeout: null };

        penalize("fullscreen_lost", "Thoát toàn màn hình");

        // Thử vào lại fullscreen
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen()
            .then(() => {
              setShowFullscreenOverlay(false);
            })
            .catch((err) => {
              console.log("ℹ️ [TakeExam] Cannot re-enter fullscreen (escalated):", err?.message || err);
            });
        }
      } else {
        // Đã vào lại fullscreen thành công -> ẩn overlay
        setShowFullscreenOverlay(false);
      }
    };
    const onVis = () => {
      if (document.hidden) {
        lastViolationTimeRef.current["_hide_start"] = Date.now();
        const msg = isMobile
          ? "Rời ứng dụng (Home/Switch App)"
          : "Rời tab / ẩn cửa sổ";
        penalize("visibility_hidden", msg);
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
    const onBlur = () => {
      // === FIX BUG 1: Bo qua neu dang hien dialog chia se man hinh ===
      if (screenShareRequestingRef.current) {
        console.log("[TakeExam] onBlur ignored - screen share dialog is open");
        return;
      }

      const blurTimestamp = Date.now();
      lastViolationTimeRef.current["_blur_start"] = blurTimestamp;

      // Show blur overlay only if they actually stay blurred
      setShowBlurOverlay(true);
      const msg = isMobile
        ? "Mất tiêu điểm (Blur) - Có thể do: Mở thông báo hoặc ứng dụng khác"
        : "Rời cửa sổ / Mất tiêu điểm (Blur)";
      penalize("window_blur", msg);
    };
    const onFocus = () => {
      // Hide blur overlay when focus returns
      setShowBlurOverlay(false);
      notifyStudentReturned();

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
      // === Kiem tra chup man hinh truoc tien ===
      const SCREENSHOT_KEYS = [
        // PrtSc don
        { check: () => e.key === "PrintScreen" && !e.ctrlKey && !e.altKey, id: "PrtSc" },
        // Ctrl+PrtSc (chup toan man hinh tren 1 so trinh duyet/ung dung)
        { check: () => e.key === "PrintScreen" && e.ctrlKey, id: "Ctrl+PrtSc" },
        // Alt+PrtSc (chup cua so hien tai tren Windows)
        { check: () => e.key === "PrintScreen" && e.altKey, id: "Alt+PrtSc" },
        // Ctrl+Shift+S (shortcut chup man hinh tren 1 so app)
        { check: () => e.ctrlKey && e.shiftKey && ["s", "S"].includes(e.key), id: "Ctrl+Shift+S" },
      ];

      for (const sk of SCREENSHOT_KEYS) {
        if (sk.check()) {
          e.preventDefault();
          e.stopPropagation();
          // Danh dau su kien dac biet la screenshot_attempt (de AI phan loai rieng)
          penalize("screenshot_attempt", `Phát hiện cố chụp màn hình: ${sk.id}`, sk.id);
          return;
        }
      }

      // === Cac phim chong gian lan thong thuong ===
      const blockKeys = ["Escape", "F11", "F3", "F4", "F5", "F12", "Tab"];
      const combos = [
        {
          check: () => e.ctrlKey && ["r", "R"].includes(e.key),
          id: `Ctrl+${e.key}`,
        },
        {
          check: () => e.ctrlKey && ["c", "C"].includes(e.key),
          id: `Ctrl+${e.key}`,
        },
        {
          check: () => e.ctrlKey && e.shiftKey && ["i", "I"].includes(e.key),
          id: `Ctrl+Shift+I`,
        },
        {
          check: () => e.ctrlKey && e.shiftKey && ["j", "J"].includes(e.key),
          id: `Ctrl+Shift+J`,
        },
        { check: () => e.altKey && e.key === "Tab", id: "Alt+Tab" },
        { check: () => e.altKey && e.key === "F4", id: "Alt+F4" },
      ];

      let matched = false;
      let keyId = e.key;
      if (blockKeys.includes(e.key)) matched = true;
      for (const c of combos) {
        if (c.check()) {
          matched = true;
          keyId = c.id;
          break;
        }
      }

      if (!matched) return;

      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      const entry = keyPressCountsRef.current[keyId] || {
        count: 0,
        last: 0,
        timeout: null,
      };

      // Reset count if last press was long ago (>3s)
      if (now - entry.last > 3000) entry.count = 0;

      entry.count += 1;
      entry.last = now;

      // Clear any existing reset timer
      if (entry.timeout) clearTimeout(entry.timeout);
      // Reset after 3s of inactivity
      entry.timeout = setTimeout(() => {
        const ecur = keyPressCountsRef.current[keyId];
        if (ecur) {
          ecur.count = 0;
          ecur.last = 0;
        }
        // Clear any failed re-entry marker for this key
        try {
          delete failedReentryRef.current[keyId];
        } catch (e) { }
      }, 3000);

      keyPressCountsRef.current[keyId] = entry;

      if (entry.count === 1) {
        flash(
          `⚠️ Phát hiện phím bị chặn: ${keyId}. Nhấn lại sẽ bị tính là vi phạm.`,
          "warn",
          3000
        );
        if (
          !document.fullscreenElement &&
          document.documentElement.requestFullscreen
        ) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.log(
              "ℹ️ [TakeExam] Cannot re-enter fullscreen (first-press):",
              err?.message || err
            );
            try {
              failedReentryRef.current[keyId] = true;
            } catch (e) { }
            flash(
              "❌ Không thể tự quay lại toàn màn hình. Vui lòng nhấn lại nút 'Bật toàn màn hình' (không tính vi phạm).",
              "warn",
              8000
            );
          });
        }
        return;
      }

      entry.count = 0;
      if (entry.timeout) {
        clearTimeout(entry.timeout);
        entry.timeout = null;
      }
      // clear failed reentry marker when escalating to violation
      try {
        delete failedReentryRef.current[keyId];
      } catch (e) { }

      // Build a readable message
      const human = keyId;
      penalize("blocked_key", `Phím bị chặn: ${human}`, keyId);
    };
    const onCtx = (e) => e.preventDefault();
    const onBefore = (e) => {
      window.__isUnloadingApp = true;
      e.preventDefault();
      e.returnValue = "";
    };

    const onCopy = (e) => {
      e.preventDefault();
      penalize("copy", "Phát hiện sao chép nội dung");
    };

    const onPaste = (e) => {
      e.preventDefault();
      penalize("paste", "Phát hiện dán nội dung");
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
          penalize("mouse_outside", `Chuột rời khỏi màn hình ${secOut}s (có thể nhìn thiết bị khác)`);
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
      const studentName = user.full_name || `Student ${user.id}`;

      // Đăng ký submission này với server
      socket.emit("student:register-submission", {
        submissionId: parseInt(submissionId),
        studentId: parseInt(user.id),
        examId: parseInt(examId),
        studentName,
      });
      console.log("📝 [Student] Registered submission with WebSocket");
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
        const res = await axiosClient.post(`${AI_URL}/api/ai/detect-behavior`, {
          student_id: parseInt(studentId),
          exam_id: parseInt(examId),
          events: eventsToSend,
          window_duration_seconds: 15
        }, {
          baseURL: "" // Bỏ qua baseURL mặc định vì trỏ sang AI server
        });

        if (res.data && res.data.success && res.data.is_cheating) {
          console.log("🚨 [AI] Behavior detected as cheating:", res.data);
          // Only trigger if confidence is high enough (e.g. > 0.6)
          if (res.data.confidence > 0.6) {
            // Format type for DB (e.g. "Multiple Tabs" -> "ai_multiple_tabs")
            const safeType = res.data.cheating_type
              ? res.data.cheating_type.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
              : 'detected_cheating';
            const aiEventType = `ai_${safeType}`;

            // Re-use logic to snapshot and alert
            penalize(aiEventType, `AI: Phát hiện vi phạm tổng hợp (Khả năng: ${Math.round(res.data.confidence * 100)}% - ${res.data.cheating_type})`);
          }
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
        try {
          sessionStorage.setItem("exam_monitoring_active", "1");
        } catch { }
      } else {
        console.log("ℹ️ [TakeExam] Monitoring disabled by instructor config");
      }
    }, 10000); // 10s grace period

    // Bắt đầu interval gửi sự kiện cho AI phân tích
    aiCheckIntervalRef.current = setInterval(runAIAnalysis, 15000);

    window.addEventListener("keydown", onKey, true);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus); // For blur overlay protection
    window.addEventListener("contextmenu", onCtx);
    window.addEventListener("beforeunload", onBefore);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    const cleanup = () => {
      clearTimeout(activateMonitoring);
      if (mobileCheckInterval) clearInterval(mobileCheckInterval);
      monitoringActiveRef.current = false;
      setMonitoringActive(false); // Also update state for inactivity hook
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
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("beforeunload", onBefore);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      if (mouseOutsideTimerRef.current) clearTimeout(mouseOutsideTimerRef.current);
      if (aiCheckIntervalRef.current) clearInterval(aiCheckIntervalRef.current);
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
      handleSubmit(true);
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
  const flash = (msg, kind = "warn", ms = 1200) => {
    setToast({ msg, kind });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => setToast({ msg: "", kind: "" }),
      ms
    );
  };

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

  const scrollTo = (qid) => {
    const el = qRefs.current[qid];
    if (el?.scrollIntoView)
      el.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const handleSubmit = async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    
    // Nếu hệ thống tự nộp bài do hết giờ
    if (auto) {
      setIsTimeUp(true);
    }

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
      if (auto) flash("Hệ thống đã tự động nộp bài", "danger", 1500);
    }
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
      ? "bg-[linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03))] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,.35),_inset_0_1px_0_rgba(255,255,255,.05)]"
      : "bg-white border border-slate-200 shadow-md";

  const headerGrad =
    "bg-[linear-gradient(90deg,rgba(106,163,255,.15),rgba(34,225,255,.12),rgba(138,126,255,.15))] backdrop-saturate-150 backdrop-blur-md";

  if (monitorScreenConfigRef.current && !screenShared && !loading && !initError && !submitted) {
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
          <h2 className="text-2xl font-bold mb-4 text-slate-800 dark:text-white">
            Bắt Buộc Chia Sẻ Màn Hình
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">
            Theo quy chế thi cử, bạn phải chia sẻ <strong>Toàn Màn Hình (Entire Screen)</strong> để tiếp tục vào bài thi. Nếu từ chối, bài thi sẽ không thể bắt đầu.
          </p>
          {screenShareError && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-semibold rounded-lg border border-red-200 dark:border-red-800">
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
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 md:gap-3 min-w-0"
          >
            <img
              src="/Logo.png"
              alt="logo"
              className="h-7 md:h-9 w-auto rounded-md shadow-[0_0_0_4px_rgba(106,163,255,.15),_0_8px_24px_rgba(0,0,0,.35)] ring-1 ring-white/20 bg-white flex-shrink-0"
            />
            <h1
              className={`text-xs md:text-sm font-semibold tracking-tight truncate ${theme === "dark" ? "text-slate-100" : "text-slate-800"
                }`}
            >
              {examTitle}
            </h1>
          </button>

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
            <div
              className={`font-mono font-bold text-xs md:text-base px-2 md:px-3 py-1.5 md:py-2 rounded-lg whitespace-nowrap ${theme === "dark"
                ? "bg-white/10 border border-white/10 text-slate-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06),_0_8px_20px_rgba(0,0,0,.25)]"
                : "bg-indigo-50 border border-slate-200 text-slate-800"
                }`}
            >
              ⏳ {fmt}
            </div>
            <button
              onClick={handleSubmitClick}
              disabled={submitting}
              className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-white text-xs md:text-base font-bold shadow-[0_8px_20px_rgba(24,201,100,.28),_inset_0_-2px_0_rgba(0,0,0,.2)] disabled:opacity-60 whitespace-nowrap"
              style={{ background: "linear-gradient(180deg,#00cf7f,#17a55c)" }}
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
          className="max-w-6xl mx-auto p-2 md:p-4 flex gap-2 md:gap-4 w-full"
          style={{ height: "calc(100vh - 80px)" }}
        >
          {/* SIDEBAR (fixed position, no scroll) - Ẩn trên mobile */}
          <aside
            className={`hidden lg:flex rounded-2xl p-4 ${cardCls} flex-shrink-0 w-64 flex-col h-full`}
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
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 pointer-events-auto select-none flex-shrink-0 overflow-y-auto max-h-[calc(100%-100px)]">
              {questions.map((q, i) => (
                <button
                  key={q.question_id}
                  title={`Câu ${i + 1}`}
                  onClick={() => scrollTo(q.question_id)}
                  className={`h-10 rounded-xl border text-sm font-semibold transition
                  ${q.__answered
                      ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-200 hover:shadow-[0_8px_16px_rgba(24,201,100,.16)]"
                      : "bg-indigo-500/10 border-indigo-400/30 text-indigo-100 hover:shadow-[0_8px_16px_rgba(138,126,255,.16)]"
                    }
                  ${theme === "dark"
                      ? "hover:ring-2 hover:ring-indigo-300/40"
                      : ""
                    }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="mt-3 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700">
              <p
                className={`${theme === "dark" ? "text-yellow-300" : "text-yellow-800"
                  } text-xs font-semibold flex items-center gap-1`}
              >
                <span>⚠️</span>
                <span>Hệ thống giám sát đang hoạt động</span>
              </p>
              <p
                className={`${theme === "dark" ? "text-yellow-400" : "text-yellow-700"
                  } text-[10px] mt-1`}
              >
                Giữ toàn màn hình. Rời tab/ESC/F11 sẽ bị cảnh cáo.
              </p>
              {violations > 0 && (
                <div className="mt-2 pt-2 border-t border-yellow-300 dark:border-yellow-700">
                  <p className="text-red-600 dark:text-red-400 text-xs font-bold">
                    🚨 Vi phạm: {violations}/5
                  </p>
                  <p className="text-red-500 dark:text-red-300 text-[10px] mt-0.5">
                    {violations >= 3
                      ? "Cảnh báo nghiêm trọng!"
                      : "Lưu ý tuân thủ quy định"}
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
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition"
                  >
                    Thử lại
                  </button>
                  <button
                    onClick={() => navigate("/verify-room")}
                    className={`px-5 py-2.5 border font-semibold rounded-lg transition
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
                  className={`rounded-xl md:rounded-2xl p-3 md:p-4 ${cardCls}`}
                >
                  {/* Câu hỏi: trắng sáng khi dark */}
                  <div
                    className={`${theme === "dark" ? "text-white" : "text-slate-800"
                      } font-bold text-sm md:text-base whitespace-pre-wrap`}
                  >
                    {idx + 1}. {q.question_text.replace(/^(?:Câu|Question)?\s*\d+[:.]?\s*/i, "")}
                  </div>
                  <div
                    className={`${theme === "dark" ? "text-slate-300" : "text-slate-500"
                      } text-xs mb-3`}
                  >
                    {q.type === "MCQ"
                      ? `Trắc nghiệm • ${q.points || 1} điểm`
                      : `Tự luận • ${q.points || 1} điểm`}
                  </div>

                  {q.type === "MCQ" ? (
                    <div className="flex flex-col gap-1.5 md:gap-2">
                      {(q.options || []).map((o) => {
                        const oid = o.option_id ?? o.id;
                        return (
                          <label
                            key={oid}
                            className={`flex items-start gap-2 md:gap-3 p-2 md:p-3 rounded-lg md:rounded-xl border cursor-pointer text-sm md:text-base
                            ${theme === "dark"
                                ? "bg-white/5 border-white/10 hover:border-blue-300/40 text-white"
                                : "bg-white border-slate-200 hover:border-blue-300 text-slate-800"
                              }`}
                          >
                            <input
                              type="radio"
                              name={`q_${q.question_id}`}
                              className="mt-0.5 md:mt-1 flex-shrink-0"
                              checked={q.__selected === oid}
                              onChange={() => {
                                saveAnswer(q, oid);
                                setQuestions((prev) =>
                                  prev.map((qq) =>
                                    qq.question_id === q.question_id
                                      ? {
                                        ...qq,
                                        __answered: true,
                                        __selected: oid,
                                      }
                                      : qq
                                  )
                                );
                              }}
                            />
                            <span
                              className={`${theme === "dark"
                                ? "text-white"
                                : "text-slate-800"
                                }`}
                            >
                              {o.option_text ?? o.text}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      rows={4}
                      value={q.__answer_text || ""}
                      placeholder="Nhập câu trả lời…"
                      data-gramm="false"
                      data-enpass="false"
                      data-lpignore="true"
                      autoComplete="off"
                      spellCheck="false"
                      className={`w-full rounded-lg md:rounded-xl p-2 md:p-3 text-sm md:text-base focus:ring-2 focus:ring-blue-300
                      ${theme === "dark"
                          ? "bg-white/5 border border-white/10 text-white placeholder:text-slate-300"
                          : "bg-white border border-slate-200 text-slate-800"
                        }`}
                      onChange={(e) => {
                        const v = e.target.value;
                        clearTimeout(window.__deb?.[q.question_id]);
                        window.__deb = window.__deb || {};
                        window.__deb[q.question_id] = setTimeout(
                          () => saveAnswer(q, v),
                          700
                        );
                        setQuestions((prev) =>
                          prev.map((qq) =>
                            qq.question_id === q.question_id
                              ? { ...qq, __answered: v && v.trim().length > 0, __answer_text: v }
                              : qq
                          )
                        );
                      }}
                    />
                  )}
                </section>
              ))
            )}
          </main>
        </div>
      </div>

      {/* TOAST */}
      {!!toast.msg && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 bottom-3 md:bottom-6 z-50 font-bold px-3 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl shadow-2xl max-w-[95vw] md:max-w-md w-full mx-2
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
          className={`w-full max-w-[560px] p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-2xl text-slate-800 bg-white`}
          style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
        >
          <h2 className={`text-base md:text-lg font-bold mb-2 ${isTimeUp ? "text-red-600" : ""}`}>
            {isTimeUp ? "⏰ Đã hết giờ làm bài!" : "Kết quả tạm thời"}
          </h2>
          {isTimeUp && (
            <p className="text-sm text-slate-600 mb-4 font-medium">
              Hệ thống đã tự động thu bài và chấm điểm các câu bạn đã làm.
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
            className="w-full mt-4 text-white text-sm md:text-base font-extrabold tracking-wide rounded-xl py-2.5 md:py-3 shadow-[0_12px_26px_rgba(106,163,255,.35),_inset_0_-2px_0_rgba(0,0,0,.2)]"
            style={{ background: "linear-gradient(180deg,#6aa3ff,#5b82ff)" }}
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

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 md:p-3 mb-3 md:mb-4 max-h-32 overflow-y-auto">
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
                    handleSubmit(false);
                  }}
                  disabled={submitting}
                  className="flex-1 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl text-white text-sm md:text-base font-bold shadow-lg disabled:opacity-60 transition"
                  style={{
                    background: "linear-gradient(180deg,#ff6b6b,#ee5a52)",
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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 md:p-3 mb-3 md:mb-4">
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
                    handleSubmit(false);
                  }}
                  disabled={submitting}
                  className="flex-1 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl text-white text-sm md:text-base font-bold shadow-lg disabled:opacity-60 transition"
                  style={{
                    background: "linear-gradient(180deg,#00cf7f,#17a55c)",
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
                className={`p-1 rounded-md hover:bg-slate-200 dark:hover:bg-white/10 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}
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
                  className={`h-10 rounded-lg border text-sm font-semibold transition flex items-center justify-center
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

            <div className="mt-auto p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700">
              <p className="text-yellow-700 dark:text-yellow-300 text-xs font-semibold mb-1">
                ⚠️ Giám sát đang bật
              </p>
              {violations > 0 && (
                <p className="text-red-600 dark:text-red-400 text-xs font-bold">
                  Vi phạm: {violations}/5
                </p>
              )}
            </div>
          </div>
        </div>
      )}


      {/* BLUR OVERLAY - Nhắc nhở SV quay lại - KHÔNG phủ đen honàn toàn (screen-share vẫn capture được nội dung) */}
      {showBlurOverlay && !submitted && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.15)' }}
        >
          <div className="text-center bg-black/60 rounded-2xl px-8 py-6 backdrop-blur-sm pointer-events-none">
            <div className="text-5xl mb-3">🔒</div>
            <h2 className="text-xl font-bold text-white">Vui lòng quay lại bài thi</h2>
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
              Số vi phạm hiện tại: {violations}/5
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
