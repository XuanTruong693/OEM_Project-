import React, { useEffect, useRef, useState } from "react";
import axiosClient from "../../api/axiosClient";
import { useParams } from "react-router-dom";

export default function InstructorOverlay() {
  const { examId } = useParams();
  const [show, setShow] = useState(false);
  const [event, setEvent] = useState(null);
  const lastIdRef = useRef(null);

  const fetch = async () => {
    try {
      const res = await axiosClient.get(
        `/instructor/exams/${examId}/violations`
      );
      const rows = res.data || [];
      if (!rows.length) return;

      // Lấy newest (đầu tiên) có is_cheating = 1 hoặc bất kỳ event nào mới
      const newest = rows[0];
      if (lastIdRef.current !== newest.id) {
        lastIdRef.current = newest.id;
        if (newest.is_cheating || (newest.details && newest.details.message)) {
          setEvent({
            id: newest.id,
            student_name: newest.student_name,
            timestamp: newest.timestamp,
            details: newest.details
              ? typeof newest.details === "string"
                ? JSON.parse(newest.details)
                : newest.details
              : {},
            cheating_count: newest.cheating_count,
          });
          setShow(true);
        }
      }
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    if (!examId) return;
    fetch();
    const t = setInterval(fetch, 5000);
    return () => clearInterval(t);
  }, [examId]);

  if (!show || !event) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-900/85 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-lg">
        <h2 className="text-3xl font-bold text-red-600">CẢNH CÁO GIAN LẬN!</h2>
        <p className="mt-4 text-lg">Sinh viên: {event.student_name}</p>
        <p>Thời gian: {new Date(event.timestamp).toLocaleString()}</p>
        <p>
          Sử dụng:{" "}
          {event.details?.key
            ? `Phím ${event.details.key}`
            : event.details?.message ?? "Không xác định"}
        </p>
        <p>Số lần: {event.cheating_count ?? "—"} / 5</p>
        <p className="mt-2 text-sm text-slate-600">
          Hệ thống đang ghi nhận sự kiện này.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setShow(false)}
            className="px-6 py-3 bg-red-600 text-white rounded-xl"
          >
            Đóng (Tiếp tục giám sát)
          </button>
          <a
            href={`/instructor/exams/${examId}/results`}
            className="px-6 py-3 bg-white border rounded-xl text-slate-900"
          >
            Xem chi tiết sinh viên
          </a>
        </div>
      </div>
    </div>
  );
}
