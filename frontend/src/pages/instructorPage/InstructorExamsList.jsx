import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { FiArrowLeft, FiClock, FiSearch } from "react-icons/fi";

const statusLabel = (status) => {
  if (!status) return { text: "draft", className: "bg-slate-100 text-slate-600" };
  if (status === "draft") return { text: "Nháp", className: "bg-slate-100 text-slate-600" };
  if (status === "published") return { text: "Đang mở", className: "bg-emerald-100 text-emerald-700" };
  if (status === "closed") return { text: "Đã đóng", className: "bg-amber-100 text-amber-700" };
  return { text: status, className: "bg-slate-100 text-slate-600" };
};

export default function InstructorExamsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosClient.get("/instructor/exams/my");
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
    return (rows || []).filter((r) =>
      norm(r.title || r.id).includes(norm(q))
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
            Danh sách đề đã tạo
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
            placeholder="Tìm đề theo tên hoặc mã phòng..."
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
            Không có đề nào.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((e) => {
              const status = statusLabel(e.status);
              return (
                <div
                  key={e.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-800">
                        {e.title || `Đề #${e.id}`}
                      </div>
                      <p className="text-sm text-slate-500">
                        Mã phòng: {e.exam_room_code || "—"}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${status.className}`}
                    >
                      {status.text}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 rounded">
                      <FiClock className="w-4 h-4" />
                      {e.duration_minutes || e.duration || 0} phút
                    </span>
                    {e.time_open && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 rounded">
                        Mở: {new Date(e.time_open).toLocaleString("vi-VN")}
                      </span>
                    )}
                    {e.time_close && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 rounded">
                        Đóng: {new Date(e.time_close).toLocaleString("vi-VN")}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => navigate(`/instructor/exams/${e.id}/edit`)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Chỉnh sửa
                    </button>
                    <button
                      onClick={() => navigate(`/instructor/exams/${e.id}/preview`)}
                      className="text-sm text-slate-600 hover:underline"
                    >
                      Xem trước
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
