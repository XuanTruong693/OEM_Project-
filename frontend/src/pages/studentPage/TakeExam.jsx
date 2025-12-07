import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import io from "socket.io-client";

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

  // ===== State =====
  const [theme, setTheme] = useState(
    () => localStorage.getItem("examTheme") || "dark"
  ); // 'dark' | 'light'
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
    } catch {}
    if (theme === "light") document.documentElement.classList.remove("dark");
    else document.documentElement.classList.add("dark");
  }, [theme]);

  // ===== Load & Start =====
  useEffect(() => {
    const start = async () => {
      if (!submissionId) {
        navigate("/verify-room");
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
          window.location.href = "/verify-room";
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
        setQuestions(merged);
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
        navigate("/verify-room");
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

      const now = Date.now();
      const lastTime = lastViolationTimeRef.current[evt];
      if (lastTime !== undefined && now - lastTime < 1000) {
        console.log(
          `⏸️ [TakeExam] Violation throttled (${evt}), last report: ${
            now - lastTime
          }ms ago`
        );
        return;
      }
      lastViolationTimeRef.current[evt] = now;

      // Report to backend (non-blocking)
      try {
        postProctor(evt, { message: msg, key });
      } catch (e) {}

      // Update local violation count and notify student
      setViolations((v) => {
        const nv = v + 1;
        if (nv >= 5) {
          flash(`🚨 Vi phạm: ${nv}/5 — Hệ thống sẽ tự động nộp bài nếu tiếp tục vi phạm.`, "danger", 8000);
          // Attempt auto-submit (best-effort)
          try {
            handleSubmit(true);
          } catch (e) {}
        } else if (nv >= 3) {
          flash(`❌ Vi phạm: ${nv}/5 — Cảnh báo nghiêm trọng`, "danger", 6000);
        } else {
          flash(`❌ Vi phạm: ${nv}/5`, "danger", 4000);
        }
        return nv;
      });

      // done
    };

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

        if (fe.count === 1) {
          // First fullscreen exit: warning only, try to recover but do not penalize
          flash("⚠️ Thoát toàn màn hình (phát hiện 1 lần). Nhấn lại sẽ bị tính là vi phạm.", "warn", 4000);
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch((err) => {
              console.log("ℹ️ [TakeExam] Cannot re-enter fullscreen on fullscreenchange (first exit):", err?.message || err);
              // mark failed re-entry so UI can instruct the user
              try { failedReentryRef.current['fullscreen'] = true; } catch (e) {}
              flash("❌ Không thể tự quay lại toàn màn hình. Vui lòng nhấn lại nút 'Bật toàn màn hình' (không tính vi phạm).", "warn", 8000);
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
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.log("ℹ️ [TakeExam] Cannot re-enter fullscreen on fullscreenchange (escalated):", err?.message || err);
          });
        }
      }
    };
    const onVis = () => {
      if (document.hidden) penalize("visibility_hidden", "Rời tab / ẩn cửa sổ");
    };
    const onBlur = () => penalize("window_blur", "Rời cửa sổ");
    const onKey = (e) => {
      // Keys and combinations we want to monitor for potential cheating
      const blockKeys = ["Escape", "F11", "F3", "F4", "F5", "F12", "Tab"]; // Allow one accidental press for these keys
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
        } catch (e) {}
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
            } catch (e) {}
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
      } catch (e) {}

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
    // Kết nối tới WebSocket server để báo cáo gian lận
    const socketUrl = import.meta.env.REACT_APP_API_URL
      ? import.meta.env.REACT_APP_API_URL
      : window.location.origin;

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
      console.log("✅ [TakeExam] Monitoring activated after 2s grace period");
      try {
        sessionStorage.setItem("exam_monitoring_active", "1");
      } catch {}
    }, 2000);

    window.addEventListener("keydown", onKey, true);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("contextmenu", onCtx);
    window.addEventListener("beforeunload", onBefore);

    const cleanup = () => {
      clearTimeout(activateMonitoring);
      monitoringActiveRef.current = false;
      try {
        sessionStorage.removeItem("exam_monitoring_active");
      } catch {}

      // ✅ Disconnect WebSocket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
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
    } catch {}
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
      } catch {}
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
        className={`sticky top-0 z-40 border-b ${
          theme === "dark" ? "border-white/10" : "border-slate-200"
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
              className={`text-xs md:text-sm font-semibold tracking-tight truncate ${
                theme === "dark" ? "text-slate-100" : "text-slate-800"
              }`}
            >
              {examTitle}
            </h1>
          </button>
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-lg border text-sm md:text-base ${
                theme === "dark"
                  ? "bg-white/10 border-white/20 text-slate-100"
                  : "bg-white border-slate-200 text-slate-800"
              }`}
              title="Đổi giao diện Sáng/Tối"
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
            <div
              className={`font-mono font-bold text-xs md:text-base px-2 md:px-3 py-1.5 md:py-2 rounded-lg whitespace-nowrap ${
                theme === "dark"
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
          className={`${
            theme === "dark" ? "bg-white/10" : "bg-slate-200"
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
                className={`text-sm font-semibold ${
                  theme === "dark" ? "text-slate-100" : "text-slate-800"
                }`}
              >
                Câu hỏi
              </h3>
              <span
                className={`${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
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
                  ${
                    q.__answered
                      ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-200 hover:shadow-[0_8px_16px_rgba(24,201,100,.16)]"
                      : "bg-indigo-500/10 border-indigo-400/30 text-indigo-100 hover:shadow-[0_8px_16px_rgba(138,126,255,.16)]"
                  }
                  ${
                    theme === "dark"
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
                className={`${
                  theme === "dark" ? "text-yellow-300" : "text-yellow-800"
                } text-xs font-semibold flex items-center gap-1`}
              >
                <span>⚠️</span>
                <span>Hệ thống giám sát đang hoạt động</span>
              </p>
              <p
                className={`${
                  theme === "dark" ? "text-yellow-400" : "text-yellow-700"
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
            {loading ? (
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
                    className={`${
                      theme === "dark" ? "text-white" : "text-slate-800"
                    } font-bold text-sm md:text-base`}
                  >
                    {idx + 1}. {q.question_text}
                  </div>
                  <div
                    className={`${
                      theme === "dark" ? "text-slate-300" : "text-slate-500"
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
                            ${
                              theme === "dark"
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
                              className={`${
                                theme === "dark"
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
                      className={`w-full rounded-lg md:rounded-xl p-2 md:p-3 text-sm md:text-base focus:ring-2 focus:ring-blue-300
                      ${
                        theme === "dark"
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
            ${
              toast.kind === "danger"
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
        className={`fixed inset-0 z-50 ${
          showModal ? "grid" : "hidden"
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
            className={`flex items-center justify-between py-2 border-b text-sm md:text-base ${
              theme === "dark"
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
            className={`flex items-center justify-between py-2 border-b text-sm md:text-base ${
              theme === "dark"
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
            className={`${
              theme === "dark" ? "text-slate-300" : "text-slate-600"
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
        className={`fixed inset-0 z-50 ${
          showConfirmModal ? "grid" : "hidden"
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
    </div>
  );
}
