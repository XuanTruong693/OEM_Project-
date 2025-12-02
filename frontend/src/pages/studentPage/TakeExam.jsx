import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import io from "socket.io-client";

export default function TakeExam() {
  const { examId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const submissionId = search.get("submission_id");
  const socketRef = useRef(null);

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
  const cleanupListenersRef = useRef(null); // Lưu hàm cleanup để gọi khi nộp bài
  const submittedRef = useRef(false); // Ref để tracking submitted state (tránh stale closure)
  const monitoringActiveRef = useRef(false); // Ref để tracking khi nào bắt đầu giám sát (sau grace period)
  const lastViolationTimeRef = useRef({}); // Track last time each event was reported (prevent duplicates)
  const [unansweredQuestions, setUnansweredQuestions] = useState([]); // Danh sách câu bỏ trống

  const qRefs = useRef({});
  const toastTimerRef = useRef(null);
  const tickRef = useRef(null);

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
      // ✅ Không tính vi phạm nếu đã nộp bài
      if (submittedRef.current) {
        console.log(
          "🛑 [TakeExam] Violation ignored - exam already submitted:",
          evt
        );
        return;
      }

      // ✅ Không tính vi phạm trước khi sinh viên bắt đầu làm bài (tránh false positive khi load trang)
      if (!monitoringActiveRef.current) {
        console.log(
          "⏳ [TakeExam] Violation ignored - monitoring not active yet:",
          evt
        );
        return;
      }

      // ✅ Throttle: Chỉ report nếu chưa report event này trong 1 giây vừa rồi
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

      setViolations((v) => {
        const nv = v + 1;
        flash(`${msg} (Cảnh cáo ${nv}/5)`, "danger", 1600);
        postProctor(evt, { message: msg, key });
        if (nv >= 5) handleSubmit(true);
        else if (
          !document.fullscreenElement &&
          document.documentElement.requestFullscreen
        ) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.log(
              "ℹ️ [TakeExam] Cannot re-enter fullscreen:",
              err.message
            );
          });
        }
        return nv;
      });
    };

    const onFs = () => {
      if (!document.fullscreenElement)
        penalize("fullscreen_lost", "Thoát toàn màn hình");
    };
    const onVis = () => {
      if (document.hidden) penalize("visibility_hidden", "Rời tab / ẩn cửa sổ");
    };
    const onBlur = () => penalize("window_blur", "Rời cửa sổ");
    const onKey = (e) => {
      const block = ["Escape", "F11", "F5"];
      if (
        block.includes(e.key) ||
        (e.ctrlKey && ["r", "R", "w", "W"].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        penalize("blocked_key", `Phím bị chặn: ${e.key}`, e.key);
      }
    };
    const onCtx = (e) => e.preventDefault();
    const onBefore = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };

    start();

    // ===== INIT WEBSOCKET CONNECTION =====
    // Kết nối tới WebSocket server để báo cáo gian lận
    // Nếu ở localhost:4000 (Vite dev), socket.io sẽ auto-proxy thông qua vite.config.js
    // Nếu ở production, dùng environment variable
    const socketUrl = import.meta.env.REACT_APP_API_URL
      ? import.meta.env.REACT_APP_API_URL
      : window.location.origin; // Auto-use current origin (localhost:4000 in dev)

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

    // ✅ START MONITORING IMMEDIATELY - Not waiting for grace period
    // Monitor from the moment student enters exam to catch any cheating attempts
    monitoringActiveRef.current = true;
    console.log(
      "✅ [TakeExam] Monitoring activated immediately upon exam start"
    );

    window.addEventListener("keydown", onKey, true);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("contextmenu", onCtx);
    window.addEventListener("beforeunload", onBefore);

    const cleanup = () => {
      monitoringActiveRef.current = false;

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

    // Lưu hàm cleanup để có thể gọi khi submit
    cleanupListenersRef.current = cleanup;

    return cleanup;
    // eslint-disable-next-line
  }, [submissionId, examId]);

  // ===== Monitoring is active from the start, no need for interaction trigger =====

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

    // ✅ Đánh dấu đã nộp bài NGAY để dừng tracking violations
    setSubmitted(true);
    submittedRef.current = true; // ✅ Cập nhật ref để penalize function nhìn thấy ngay

    // ✅ Dừng hoàn toàn việc theo dõi màn hình - xóa tất cả event listeners
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
            className="flex items-center gap-3"
          >
            <img
              src="/Logo.png"
              alt="logo"
              className="h-9 w-auto rounded-md shadow-[0_0_0_4px_rgba(106,163,255,.15),_0_8px_24px_rgba(0,0,0,.35)] ring-1 ring-white/20 bg-white"
            />
            <h1
              className={`text-sm font-semibold tracking-tight ${
                theme === "dark" ? "text-slate-100" : "text-slate-800"
              }`}
            >
              {examTitle}
            </h1>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className={`px-3 py-2 rounded-lg border ${
                theme === "dark"
                  ? "bg-white/10 border-white/20 text-slate-100"
                  : "bg-white border-slate-200 text-slate-800"
              }`}
              title="Đổi giao diện Sáng/Tối"
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
            <div
              className={`font-mono font-bold text-base px-3 py-2 rounded-lg ${
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
              className="px-4 py-2 rounded-xl text-white font-bold shadow-[0_8px_20px_rgba(24,201,100,.28),_inset_0_-2px_0_rgba(0,0,0,.2)] disabled:opacity-60"
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
          className="max-w-6xl mx-auto p-4 flex gap-4 w-full"
          style={{ height: "calc(100vh - 80px)" }}
        >
          {/* SIDEBAR (fixed position, no scroll) */}
          <aside
            className={`rounded-2xl p-4 ${cardCls} flex-shrink-0 w-64 flex flex-col h-full`}
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
            <div className="grid grid-cols-5 gap-2 pointer-events-auto select-none flex-shrink-0 overflow-y-auto max-h-[calc(100%-100px)]">
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
            <p
              className={`${
                theme === "dark" ? "text-slate-400" : "text-slate-600"
              } text-sm mt-3 flex-shrink-0`}
            >
              Giữ chế độ toàn màn hình. Rời tab/ESC/F11 sẽ bị cảnh cáo.
            </p>
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
                  className={`rounded-2xl p-4 ${cardCls}`}
                >
                  {/* Câu hỏi: trắng sáng khi dark */}
                  <div
                    className={`${
                      theme === "dark" ? "text-white" : "text-slate-800"
                    } font-bold text-base`}
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
                    <div className="flex flex-col gap-2">
                      {(q.options || []).map((o) => {
                        const oid = o.option_id ?? o.id;
                        return (
                          <label
                            key={oid}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer
                            ${
                              theme === "dark"
                                ? "bg-white/5 border-white/10 hover:border-blue-300/40 text-white"
                                : "bg-white border-slate-200 hover:border-blue-300 text-slate-800"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q_${q.question_id}`}
                              className="mt-1"
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
                      rows={5}
                      placeholder="Nhập câu trả lời…"
                      className={`w-full rounded-xl p-3 focus:ring-2 focus:ring-blue-300
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
          className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 text-slate-900 font-bold px-4 py-2 rounded-xl shadow-2xl
            ${
              toast.kind === "danger"
                ? "bg-red-300"
                : toast.kind === "warn"
                ? "bg-yellow-300"
                : "bg-white"
            }`}
        >
          {toast.msg}
        </div>
      )}

      {/* MODAL */}
      <div
        className={`fixed inset-0 z-50 ${
          showModal ? "grid" : "hidden"
        } place-items-center bg-black/50`}
      >
        <div
          className={`w-[min(560px,94vw)] p-6 rounded-2xl border border-slate-200 shadow-2xl text-slate-800 bg-white`}
          style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
        >
          <h2 className="text-lg font-bold mb-2">Kết quả tạm thời</h2>
          <div
            className={`flex items-center justify-between py-2 border-b ${
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
            className={`flex items-center justify-between py-2 border-b ${
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
          <div className="flex items-center justify-between py-2">
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
            } text-sm mt-1`}
          >
            Điểm tự luận sẽ được AI & giảng viên xác nhận sau.
          </div>

          <button
            className="w-full mt-4 text-white font-extrabold tracking-wide rounded-xl py-3 shadow-[0_12px_26px_rgba(106,163,255,.35),_inset_0_-2px_0_rgba(0,0,0,.2)]"
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
        } place-items-center bg-black/60 backdrop-blur-sm`}
      >
        <div
          className="w-[min(520px,94vw)] p-6 rounded-2xl border border-slate-200 shadow-2xl bg-white"
          style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
        >
          {unansweredQuestions.length > 0 ? (
            <>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Cảnh báo: Có câu hỏi bỏ trống
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Bạn đang bỏ trống{" "}
                    <strong className="text-red-600">
                      {unansweredQuestions.length} câu hỏi
                    </strong>
                    :
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
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
                        className="px-3 py-1 bg-red-100 border border-red-300 rounded-lg text-red-700 font-semibold text-sm hover:bg-red-200 transition"
                      >
                        Câu {qIndex}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-sm text-slate-700 mb-4">
                Bạn có muốn tiếp tục nộp bài không? Các câu bỏ trống sẽ không
                được tính điểm.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Quay lại làm tiếp
                </button>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    handleSubmit(false);
                  }}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-xl text-white font-bold shadow-lg disabled:opacity-60 transition"
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
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">✋</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Xác nhận nộp bài
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Bạn đã hoàn thành{" "}
                    <strong className="text-green-600">
                      {counts.answered}/{counts.total} câu hỏi
                    </strong>
                    .
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-slate-700">
                  ⏰ Thời gian còn lại:{" "}
                  <strong className="text-blue-600 font-mono">{fmt}</strong>
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  Sau khi nộp bài, bạn sẽ không thể chỉnh sửa câu trả lời.
                </p>
              </div>

              <p className="text-base text-slate-800 font-semibold mb-4">
                Bạn có chắc chắn muốn nộp bài không?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Quay lại làm tiếp
                </button>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    handleSubmit(false);
                  }}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-xl text-white font-bold shadow-lg disabled:opacity-60 transition"
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
