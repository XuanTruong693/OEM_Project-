import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { FiArrowLeft, FiClock, FiSearch } from "react-icons/fi";

const statusStyle = (status) => {
  if (status === "submitted" || status === "confirmed") {
    return "text-emerald-700 bg-emerald-50";
  }
  if (status === "in_progress") return "text-amber-700 bg-amber-50";
  return "text-slate-700 bg-slate-50";
};

export default function InstructorSubmissionsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosClient.get("/instructor/dashboard/submissions");
        setRows(res.data || []);
      } catch (e) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const norm = (s) => String(s || "").toLowerCase();
    return (rows || []).filter(
      (r) =>
        norm(r.exam_title || r.exam_id).includes(norm(q)) ||
        norm(r.student_name || r.student_id).includes(norm(q))
    );
  }, [rows, q]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/instructor-dashboard")}
            className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600"
          >
            <FiArrowLeft className="w-4 h-4" />
            Quay lại Dashboard
          </button>
          <h1 className="text-base font-semibold text-slate-800">
            Danh sách bài kiểm tra
          </h1>
          <div className="text-xs text-slate-500">
            Tổng cộng: {rows?.length || 0}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <FiSearch className="text-slate-400 w-5 h-5" />
          <input
            className="flex-1 focus:outline-none text-sm"
            placeholder="Tìm theo bài thi hoặc thí sinh..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-600">
            Đang tải danh sách...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-600">
            Không có bài kiểm tra.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <div
                key={s.submission_id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-500">
                      Bài thi:{" "}
                      <span className="font-semibold text-slate-800">
                        {s.exam_title || `Exam #${s.exam_id}`}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500">
                      Thí sinh:{" "}
                      <span className="font-semibold text-slate-800">
                        {s.student_name || `User #${s.student_id}`}
                      </span>
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                      <FiClock className="w-4 h-4" />
                      {s.submitted_at
                        ? new Date(s.submitted_at).toLocaleString("vi-VN")
                        : "Chưa nộp"}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle(
                        s.status
                      )}`}
                    >
                      {s.status || "unknown"}
                    </div>
                    <div className="text-lg font-semibold text-slate-800">
                      {s.total_score != null ? s.total_score : "—"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
