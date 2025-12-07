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
      try {
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
      <header className="flex items-center justify-between mb-5 rounded-2xl px-4 py-3 border border-slate-200 bg-gradient-to-r from-white to-slate-50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl grid place-items-center bg-blue-600 text-white shadow">
            📄
          </div>
          <h1 className="text-lg font-semibold text-slate-800">
            {t("preview_title", "Preview – Xem trước", "Preview")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold shadow-sm">
            {total} Tổng cộng
          </div>
          <div className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold shadow-sm">
            {mcq} Trắc nghiệm
          </div>
          <div className="px-3 py-1 rounded-lg bg-violet-50 text-violet-700 text-sm font-semibold shadow-sm">
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
                  Câu {idx + 1}: {q.question_text}
                </div>
              )}
              {q.type === "MCQ" ? (
                <ul className="space-y-1">
                  {(q.options || []).map((o, i) => (
                    <li
                      key={o.option_id}
                      className={`flex items-center gap-2 ${
                        o.is_correct ? "text-emerald-600 font-medium" : ""
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

      {/* Warning modal */}
      {showWarn && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-3">
              Cảnh báo: Đề thi đã có dữ liệu
            </h3>
            <p className="text-sm text-slate-700 mb-3">
              Bài thi này đã có dữ liệu sinh viên (số bài:{" "}
              <strong>{summary?.total_submissions || 0}</strong>). Nếu bạn sử
              dụng chính đề này để mở phòng thi mới, tất cả dữ liệu sinh viên
              hiện có trong đề sẽ bị xóa và không thể khôi phục.
            </p>
            {modalErr && (
              <div className="text-red-600 text-sm mb-2">{modalErr}</div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowWarn(false)}
                className="px-3 py-2 rounded-lg border"
              >
                Hủy
              </button>
              <button
                onClick={handlePurgeAndOpen}
                disabled={modalBusy}
                className="px-3 py-2 rounded-lg bg-rose-500 text-white"
              >
                Tiếp tục (Xóa dữ liệu và mở phòng)
              </button>
              <button
                onClick={handleCloneAndEdit}
                disabled={modalBusy}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white"
              >
                Tạo đề khác (bản sao) và chỉnh sửa
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
