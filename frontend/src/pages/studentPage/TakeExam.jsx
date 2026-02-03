import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { SOCKET_URL } from "../../api/config";
import io from "socket.io-client";
import { useInactivityMonitor } from "../../hooks/useInactivityMonitor";

export default function TakeExam() {
  // PRNG helper
  const mulberry32 = (a) => {
    return () => {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
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
  const [showMobileNav, setShowMobileNav] = useState(false); // Mobile drawer state
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false); // Overlay bắt buộc vào lại fullscreen
  const [monitoringActive, setMonitoringActive] = useState(false); // State for inactivity hook (not ref)
  const [showBlurOverlay, setShowBlurOverlay] = useState(false); // Blur overlay for screenshot protection

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
        if (
          checkRes.data?.submitted_at ||
          ["submitted", "graded"].includes(checkRes.data?.status)
        ) {
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
          base.__answered = !!(
            a?.selected_option_id ||
            (a?.answer_text && a.answer_text.trim())
          );
          return base;
        });
        let finalQuestions = merged;

        // Xử lý random (shuffle) câu hỏi nếu instructor bật
        if (res.data?.intent_shuffle) {
          console.log(
            "🔀 [TakeExam] intent_shuffle is ON -> Shuffling questions (grouped by type)..."
          );

          // Seed: submissionId XOR started_at để tạo sự ngẫu nhiên tốt hơn
          const baseId = parseInt(submissionId, 10) || 9999;
          const timeComponent = res.data?.started_at
            ? Math.floor(new Date(res.data.started_at).getTime() / 1000)
            : Math.floor(Date.now() / 1000);
          // XOR để tạo seed đa dạng hơn
          const seed = (baseId * 31) ^ timeComponent;

          console.log(
            `🎲 [TakeExam] Shuffle seed: ${seed} (submissionId=${baseId}, time=${timeComponent})`
          );

          // 1. Group by type to keep sections separated (e.g. MCQ section, Essay section)
          const typesParam = [...new Set(finalQuestions.map(q => q.type))];
          const groups = finalQuestions.reduce((acc, q) => {
            (acc[q.type] ||= []).push(q);
            return acc;
          }, {});

          let shuffledAll = [];

          typesParam.forEach((type, typeIdx) => {
            const list = groups[type];
            const originalIds = list.map(q => q.question_id);
            console.log(`📌 [Shuffle] Type "${type}": ${list.length} questions BEFORE:`, originalIds);

            if (list.length <= 1) {
              // Chỉ 1 câu hỏi, không cần shuffle
              shuffledAll.push(...list);
              console.log(`⏭️ [Shuffle] Type "${type}": Only 1 question, skipping shuffle`);
              return;
            }

            // Unique seed per type
            const typeSeed = seed + (typeIdx + 1) * 1337;
            const rng = mulberry32(typeSeed);

            const shuffled = [...list];

            // Fisher-Yates shuffle
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(rng() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }

            // Đảm bảo có sự thay đổi: nếu shuffle ra giống hoàn toàn thì swap phần tử đầu và cuối
            const shuffledIds = shuffled.map(q => q.question_id);
            const isSameOrder = originalIds.every((id, idx) => id === shuffledIds[idx]);

            if (isSameOrder && shuffled.length >= 2) {
              console.log(`⚠️ [Shuffle] Same order detected, forcing swap...`);
              [shuffled[0], shuffled[shuffled.length - 1]] = [shuffled[shuffled.length - 1], shuffled[0]];
            }

            const finalIds = shuffled.map(q => q.question_id);
            console.log(`✅ [Shuffle] Type "${type}": ${shuffled.length} questions AFTER:`, finalIds);
            shuffledAll.push(...shuffled);
          });

          finalQuestions = shuffledAll;
        }

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
        setRemaining(Math.max(0, durSec - passed));

        setExamTitle(res.data?.exam_title || `Bài thi #${examId}`);

        // Hiển thị thông báo bắt đầu giám sát
        flash(
          "📹 Hệ thống giám sát đã kích hoạt. Giữ toàn màn hình!",
          "warn",
          3000
        );

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

      // Report to backend (non-blocking)
      try {
        postProctor(evt, { message: msg, key });
      } catch (e) { }

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
        const msg = isMobile
          ? "Rời ứng dụng (Home/Switch App)"
          : "Rời tab / ẩn cửa sổ";
        penalize("visibility_hidden", msg);
      }
    };
    const onBlur = () => {
      // Show blur overlay immediately to protect against screenshots
      setShowBlurOverlay(true);

      const msg = isMobile
        ? "Mất tiêu điểm (Blur) - Có thể do: Chụp màn hình, mở thông báo hoặc Control Center"
        : "Rời cửa sổ / Mất tiêu điểm (Blur)";
      penalize("window_blur", msg);
    };
    const onFocus = () => {
      // Hide blur overlay when focus returns
      setShowBlurOverlay(false);
    };
    const onKey = (e) => {
      // Keys and combinations we want to monitor for potential cheating
      // Added PrintScreen for detection
      const blockKeys = ["Escape", "F11", "F3", "F4", "F5", "F12", "Tab", "PrintScreen"];
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
      e.preventDefault();
      e.returnValue = "";
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
    const activateMonitoring = setTimeout(() => {
      monitoringActiveRef.current = true;
      setMonitoringActive(true); // Also update state for inactivity hook
      console.log("✅ [TakeExam] Monitoring activated after 2s grace period");
      try {
        sessionStorage.setItem("exam_monitoring_active", "1");
      } catch { }
    }, 2000);

    window.addEventListener("keydown", onKey, true);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus); // For blur overlay protection
    window.addEventListener("contextmenu", onCtx);
    window.addEventListener("beforeunload", onBefore);

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

  return (
    <div className={`min-h-screen flex flex-col ${shellBg} overflow-hidden`}>
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
                      } font-bold text-sm md:text-base`}
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
                              ? { ...qq, __answered: v && v.trim().length > 0 }
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
          <h2 className="text-base md:text-lg font-bold mb-2">
            Kết quả tạm thời
          </h2>
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


      {/* BLUR OVERLAY - Bảo vệ khỏi chụp màn hình */}
      {showBlurOverlay && !submitted && (
        <div
          className="fixed inset-0 z-[200] backdrop-blur-xl bg-black/80 flex items-center justify-center"
          style={{ WebkitBackdropFilter: 'blur(20px)', backdropFilter: 'blur(20px)' }}
        >
          <div className="text-center text-white p-8">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold mb-2">Nội dung đã được bảo vệ</h2>
            <p className="text-gray-300">Vui lòng quay lại bài thi để tiếp tục</p>
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
