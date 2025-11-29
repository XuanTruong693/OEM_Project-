import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { FiArrowLeft, FiSearch, FiUser } from "react-icons/fi";

export default function InstructorStudentsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosClient.get("/instructor/dashboard/students");
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
        norm(r.student_name || r.student_id).includes(norm(q)) ||
        norm(r.email).includes(norm(q))
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
            Danh sách thí sinh đã thi
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
            placeholder="Tìm theo tên hoặc email thí sinh..."
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
            Chưa có thí sinh nào.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <div
                key={s.student_id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 grid place-items-center">
                    <FiUser />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-500">
                      Tên:{" "}
                      <span className="font-semibold text-slate-800">
                        {s.student_name || `User #${s.student_id}`}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Email: {s.email || "—"}
                    </div>
                  </div>
                  <div className="text-right text-sm text-slate-600">
                    <div>
                      Bài đã thi:{" "}
                      <span className="font-semibold text-slate-800">
                        {s.submissions_count}
                      </span>
                    </div>
                    <div>
                      Điểm TB:{" "}
                      <span className="font-semibold text-slate-800">
                        {s.avg_score != null ? Number(s.avg_score).toFixed(1) : "—"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Lần cuối:{" "}
                      {s.last_submitted_at
                        ? new Date(s.last_submitted_at).toLocaleString("vi-VN")
                        : "—"}
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
