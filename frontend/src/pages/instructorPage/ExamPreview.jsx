import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { useUi } from "../../context/UiContext.jsx";

export default function ExamPreview() {
  const { examId } = useParams();
  const nav = useNavigate();
  const { t } = useUi();
  const [data, setData] = React.useState({ questions: [] });
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [examInfo, setExamInfo] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {2
        const res = await axiosClient.get(
          `/instructor/exams/${examId}/preview`
        );
        const previewData = res.data || { questions: [] };
        setData(previewData);

        // Lưu thông tin exam (time_open, time_close, status)
        const examData = {
          time_open: previewData.time_open,
          time_close: previewData.time_close,
          status: previewData.status,
        };
        console.log("📊 [ExamPreview] Exam info:", examData);
        setExamInfo(examData);
      } catch (e) {
        console.error("❌ [ExamPreview] Error:", e);
        setErr("Không thể tải preview đề thi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  const qs = data.questions || [];
  const total = qs.length;
  const mcq = qs.filter((q) => q.type === "MCQ").length;
  const essay = total - mcq;

  // Kiểm tra xem bài thi có đang trong quá trình không
  const isInProgress = React.useMemo(() => {
    if (!examInfo || !examInfo.time_open || !examInfo.time_close) {
      console.log("⚠️ [ExamPreview] Missing time info:", examInfo);
      return false;
    }

    const now = new Date();
    const open = new Date(examInfo.time_open);
    const close = new Date(examInfo.time_close);

    console.log("🕐 [ExamPreview] Time check:", {
      now: now.toISOString(),
      open: open.toISOString(),
      close: close.toISOString(),
      isAfterOpen: now >= open,
      isBeforeClose: now <= close,
    });

    // Trong quá trình: now >= time_open && now <= time_close
    const inProgress = now >= open && now <= close;
    console.log(`🔍 [ExamPreview] isInProgress: ${inProgress}`);
    return inProgress;
  }, [examInfo]);

  const splitQA = (q) => {
    const text = (q?.question_text || "").trim();
    const direct = (q?.model_answer || "").trim();
    const markers = ["câu trả lời:", "cau tra loi:", "answer:"];
    const lower = text.toLowerCase();
    let cut = -1;
    let markerLen = 0;
    for (const m of markers) {
      const i = lower.indexOf(m);
      if (i >= 0) {
        cut = i;
        markerLen = m.length;
        break;
      }
    }
    if (direct) {
      if (cut >= 0)
        return { stem: text.substring(0, cut).trim(), model: direct };
      return { stem: text, model: direct };
    }
    if (cut >= 0) {
      const stem = text
        .substring(0, cut)
        .trim()
        .replace(/[\s:]*$/, "");
      const model = text.substring(cut + markerLen).trim();
      return { stem, model };
    }
    return { stem: text, model: "" };
  };

  const [showWarn, setShowWarn] = React.useState(false);
  const [summary, setSummary] = React.useState(null);
  const [modalBusy, setModalBusy] = React.useState(false);
  const [modalErr, setModalErr] = React.useState("");

  const handleStartOpen = async () => {
    try {
      setModalErr("");
      // fetch summary to know if there are existing submissions
      const res = await axiosClient.get(`/instructor/exams/${examId}/summary`);
      const s = res.data || {};
      console.log(`📊 [ExamPreview] Summary for exam ${examId}:`, s);
      setSummary(s);
      // if there are existing submissions OR the exam was published before, warn
      const hasData =
        (s.total_submissions || 0) > 0 ||
        (examInfo && String(examInfo.status) === "published");
      if (hasData) {
        setShowWarn(true);
        return;
      }
      // otherwise go to settings normally
      nav(`/exam-settings/${examId}`);
    } catch (e) {
      console.error("❌ [ExamPreview] open error:", e);
      setModalErr("Không thể kiểm tra trạng thái đề thi. Vui lòng thử lại.");
    }
  };

  const handlePurgeAndOpen = async () => {
    try {
      setModalBusy(true);
      setModalErr("");
      await axiosClient.post(`/instructor/exams/${examId}/purge`);
      setShowWarn(false);
      // Now navigate to exam settings so instructor can configure and open
      nav(`/exam-settings/${examId}`);
    } catch (e) {
      console.error("❌ [ExamPreview] purge error:", e);
      setModalErr("Không thể xóa dữ liệu. Vui lòng thử lại.");
    } finally {
      setModalBusy(false);
    }
  };

  const handleCloneAndEdit = async () => {
    try {
      setModalBusy(true);
      setModalErr("");
      const res = await axiosClient.post(`/instructor/exams/${examId}/clone`);
      const newId = res.data?.exam_id;
      if (!newId) throw new Error("Clone failed");
      setShowWarn(false);
      // Navigate to edit page and open review tab
      nav(`/instructor/exams/${newId}/edit?tab=review`);
    } catch (e) {
      console.error("❌ [ExamPreview] clone error:", e);
      setModalErr("Không thể tạo bản sao đề. Vui lòng thử lại.");
    } finally {
      setModalBusy(false);
    }
  };

  return (
    <div className="p-4">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 rounded-2xl px-4 py-3 border border-slate-200 bg-gradient-to-r from-white to-slate-50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl grid place-items-center bg-blue-600 text-white shadow flex-shrink-0">
            📄
          </div>
          <h1 className="text-base sm:text-lg font-semibold text-slate-800">
            {t("preview_title", "Preview – Xem trước", "Preview")}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-2 sm:px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs sm:text-sm font-semibold shadow-sm">
            {total} Tổng
          </div>
          <div className="px-2 sm:px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs sm:text-sm font-semibold shadow-sm">
            {mcq} Trắc nghiệm
          </div>
          <div className="px-2 sm:px-3 py-1 rounded-lg bg-violet-50 text-violet-700 text-xs sm:text-sm font-semibold shadow-sm">
            {essay} Tự luận
          </div>
        </div>
      </header>

      {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
      {loading ? (
        <p>Đang tải…</p>
      ) : (
        <div className="space-y-3 max-h-[75vh] overflow-auto pr-2">
          {qs.map((q, idx) => (
            <section
              key={q.question_id}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-4 hover:border-blue-300 hover:shadow transition"
            >
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 font-bold">
                  T
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  {q.type}
                </span>
              </div>
              {q.type === "Essay" ? (
                <div className="font-semibold mb-2">
                  Câu {idx + 1}: {splitQA(q).stem}
                </div>
              ) : (
                <div className="font-semibold mb-2">
                  Câu {idx + 1}: {q.question_text.replace(/^(?:Câu|Question)?\s*\d+[:.]?\s*/i, "")}
                </div>
              )}
              {q.type === "MCQ" ? (
                <ul className="space-y-1">
                  {(q.options || []).map((o, i) => (
                    <li
                      key={o.option_id}
                      className={`flex items-center gap-2 ${o.is_correct ? "text-emerald-600 font-medium" : ""
                        }`}
                    >
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span>{o.option_text}</span>
                      {o.is_correct && <span>✓</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-700">
                  <div className="italic text-slate-500">Đáp án mẫu:</div>
                  <div className="mt-1 whitespace-pre-wrap">
                    {splitQA(q).model || "—"}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => nav("/open-exam")}
          className="text-blue-600 hover:underline"
        >
          ← Quay lại danh sách
        </button>

        {/* Ẩn nút "Bắt đầu mở phòng" nếu bài thi đang trong quá trình */}
        {!isInProgress ? (
          <button
            onClick={() => handleStartOpen()}
            className="px-4 py-2 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow hover:brightness-105"
          >
            Bắt đầu mở phòng
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="px-4 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <span className="font-semibold">🔒 Bài thi đang diễn ra</span>
              <div className="text-xs mt-1">
                Kết thúc:{" "}
                {examInfo?.time_close
                  ? new Date(examInfo.time_close).toLocaleString()
                  : "-"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Warning modal - Modern Tech Style */}
      {showWarn && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-gradient-to-br from-slate-900/70 via-slate-800/60 to-slate-900/70 backdrop-blur-sm">
          <div
            className="w-full max-w-xl bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-3xl shadow-2xl border border-white/50 overflow-hidden animate-[fadeIn_0.3s_ease-out]"
            style={{
              animation: 'fadeIn 0.3s ease-out, slideUp 0.3s ease-out',
            }}
          >
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 px-6 py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur grid place-items-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  ⚠️ Cảnh báo dữ liệu
                </h3>
                <p className="text-white/80 text-sm">
                  Đề thi đã có {summary?.total_submissions || 0} bài nộp
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-2xl p-4 mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 grid place-items-center flex-shrink-0 shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-slate-700 leading-relaxed">
                      Nếu bạn sử dụng <span className="font-semibold text-amber-700">chính đề này</span> để mở phòng thi mới,
                      <span className="text-red-600 font-semibold"> tất cả dữ liệu sinh viên hiện có sẽ bị xóa vĩnh viễn</span> và không thể khôi phục.
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats card */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {summary?.total_submissions || 0}
                  </div>
                  <div className="text-sm text-slate-600">Bài nộp hiện có</div>
                </div>
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-4 border border-violet-100">
                  <div className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                    #{examId}
                  </div>
                  <div className="text-sm text-slate-600">Mã đề thi</div>
                </div>
              </div>

              {modalErr && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-red-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">{modalErr}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="px-6 pb-6 flex flex-col gap-3">
              {/* Primary actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handlePurgeAndOpen}
                  disabled={modalBusy}
                  className="group relative px-4 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Xóa & Mở phòng</span>
                  </div>
                  <div className="text-xs opacity-80 mt-1">⚡ Xóa toàn bộ dữ liệu cũ</div>
                </button>

                <button
                  onClick={handleCloneAndEdit}
                  disabled={modalBusy}
                  className="group relative px-4 py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Tạo bản sao</span>
                  </div>
                  <div className="text-xs opacity-80 mt-1">✨ Giữ nguyên dữ liệu cũ</div>
                </button>
              </div>

              {/* Cancel button */}
              <button
                onClick={() => setShowWarn(false)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200 transition-all duration-200 hover:scale-[1.01]"
              >
                ← Quay lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function useModalState() {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  return { open, setOpen, busy, setBusy };
}
