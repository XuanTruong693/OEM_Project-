// ✅ Bản chuẩn của VerifyRoom.jsx (không đổi UI, chỉ đổi logic)
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import LoadingSpinner from "../components/LoadingSpinner";

export default function VerifyRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const role = localStorage.getItem("selectedRole");

  useEffect(() => {
    const fromRoleSelection = location.state?.fromRoleSelection;
    const fromStudentDashboard = location.state?.fromStudentDashboard;

    // Nếu đến từ role selection hoặc student dashboard, cho phép vào
    if (!fromRoleSelection && !fromStudentDashboard) {
      const token = localStorage.getItem("token");
      const userRole = localStorage.getItem("role");
      if (token && userRole) {
        navigate(
          `/${userRole === "student" ? "student" : "instructor"}-dashboard`
        );
        return;
      }
    }

    if (!role || role !== "student") {
      navigate("/");
    }
  }, [role, navigate, location.state]);

  const handleVerify = async () => {
    if (!roomCode.trim()) {
      setError("Vui lòng nhập mã phòng");
      setSuccess("");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      // Ưu tiên gọi endpoint mới để lấy room_token
      const resNew = await axiosClient.post('/exams/verify-room', { room_code: roomCode.trim() });
      console.log('[DEV] Verify room (new) response:', resNew.data);
      const { exam_id, duration_minutes, room_token, require_face_check, require_student_card, monitor_screen, time_open, time_close } = resNew.data || {};
      if (room_token && exam_id) {
        // Lưu token phòng ở sessionStorage (ngắn hạn)
        sessionStorage.setItem('room_token', room_token);
        sessionStorage.setItem('pending_exam_id', String(exam_id));
        if (duration_minutes) sessionStorage.setItem('pending_exam_duration', String(duration_minutes));
        try {
          sessionStorage.setItem('exam_flags', JSON.stringify({ face: !!require_face_check, card: !!require_student_card, monitor: !!monitor_screen }));
        } catch(e) {}
        if (time_open) sessionStorage.setItem('exam_time_open', String(time_open));
        if (time_close) sessionStorage.setItem('exam_time_close', String(time_close));
        // Lưu code cũ để tương thích các flow tồn tại
        localStorage.setItem('verifiedRoomId', roomCode.trim());
        localStorage.setItem('verifiedRoomCode', roomCode.trim());

        setSuccess('✅ Mã phòng thi hợp lệ! Đang chuyển hướng...');
        setTimeout(() => {
          navigate('/login', { state: { role, fromVerifyRoom: true } });
        }, 800);
        return;
      }

      // Fallback sang API cũ nếu không có room_token
      const res = await axiosClient.get(`/auth/verify-room/${roomCode}`);
      console.log("[DEV] Verify room (legacy) response:", res.data);
      if (res.data.valid) {
        setSuccess("✅ Mã phòng thi hợp lệ! Đang chuyển hướng...");
        localStorage.setItem("verifiedRoomId", res.data.examCode);
        localStorage.setItem("verifiedRoomCode", res.data.examCode);
        setTimeout(() => navigate('/login', { state: { role, fromVerifyRoom: true } }), 800);
      } else {
        setError(res.data.message || "Mã phòng không hợp lệ");
        setSuccess("");
      }
    } catch (error) {
      // Nếu 403 do hết giờ/chưa mở → hiển thị và không fallback
      const m = error?.response?.data?.message || error?.message;
      if (error?.response?.status === 403) {
        setError(m || 'Không thể vào phòng thi (thời gian)');
        setSuccess('');
        return;
      }
      console.warn('[VerifyRoom] new verify failed, try legacy route…', error?.response?.data || error?.message || error);
      try {
        const res = await axiosClient.get(`/auth/verify-room/${roomCode}`);
        if (res.data?.valid) {
          localStorage.setItem("verifiedRoomId", res.data.examCode);
          localStorage.setItem("verifiedRoomCode", res.data.examCode);
          setSuccess("✅ Mã phòng thi hợp lệ! Đang chuyển hướng...");
          setTimeout(() => navigate('/login', { state: { role, fromVerifyRoom: true } }), 800);
        } else {
          setError(res.data?.message || "Mã phòng không hợp lệ");
        }
      } catch (e2) {
        setError(e2?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 backdrop-blur-md bg-white/60 border-b border-white/60 shadow-lg">
        <div className="mx-auto flex items-center justify-between px-6 py-4 max-w-6xl">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => navigate("/")}
          >
            <img
              src="/Logo.png"
              alt="OEM Logo"
              className="h-12 sm:h-14 w-auto transition-transform group-hover:scale-105"
            />
          </div>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-white/50 hover:bg-white/80 rounded-lg border border-slate-200 flex items-center gap-2 transition-all hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Quay lại
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-4">
        <div className="w-full max-w-lg">
          {/* Card */}
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 overflow-hidden transform transition-all hover:shadow-blue-500/10">
            {/* Header section with modern gradient */}
            <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 px-8 py-6 text-center overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12 blur-2xl"></div>
              
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white backdrop-blur-xl mb-4 border-2 border-white/40 shadow-2xl overflow-hidden">
                  <img 
                    src="/Logo.png" 
                    alt="OEM Logo" 
                    className="w-24 h-24 object-contain filter brightness-110 contrast-110"
                  />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1.5 drop-shadow-md">Xác Minh Phòng Thi</h2>
                <p className="text-blue-50 text-xs font-medium">Nhập mã phòng để bắt đầu bài kiểm tra</p>
              </div>
            </div>

            {/* Form section */}
            <div className="px-8 py-6">
              {/* Info box with modern design */}
              <div className="mb-5 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 rounded-2xl shadow-sm">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-blue-900 mb-0.5">Hướng dẫn sử dụng</p>
                    <p className="text-xs text-blue-700 leading-relaxed">Mã phòng thi do giảng viên cung cấp. Vui lòng nhập chính xác để truy cập bài kiểm tra.</p>
                  </div>
                </div>
              </div>

              {/* Input field with enhanced styling */}
              <div className="mb-5">
                <label htmlFor="roomCode" className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></span>
                  Mã phòng thi
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                  </div>
                  <input
                    id="roomCode"
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleVerify();
                    }}
                    maxLength={12}
                    className="w-full pl-12 pr-5 py-3 border-2 border-slate-200 rounded-2xl text-slate-800 font-mono text-base font-semibold tracking-wider focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:text-sm placeholder:tracking-normal disabled:bg-slate-50 disabled:cursor-not-allowed shadow-sm hover:border-slate-300"
                    placeholder="VD: ABC12345"
                    disabled={loading}
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    {roomCode.trim() && !loading && (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              {/* Error message with enhanced design */}
              {error && (
                <div className="mb-4 p-3 bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200 rounded-2xl flex gap-3 animate-shake shadow-sm">
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-red-900 mb-0.5">Xác minh thất bại</p>
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {/* Success message with enhanced design */}
              {success && (
                <div className="mb-4 p-3 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl flex gap-3 shadow-sm">
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-green-900 mb-0.5">Thành công!</p>
                    <p className="text-xs text-green-700">{success}</p>
                  </div>
                </div>
              )}

              {/* Submit button with modern gradient */}
              <button
                onClick={handleVerify}
                disabled={loading || !roomCode.trim()}
                className={`w-full py-3 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg transform ${
                  loading || !roomCode.trim()
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 hover:from-blue-600 hover:via-indigo-700 hover:to-purple-700 active:scale-[0.97] hover:shadow-2xl hover:shadow-blue-500/30 hover:-translate-y-0.5"
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm">Đang xác minh...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">Xác nhận và bắt đầu</span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white text-slate-500 font-medium">Hoặc</span>
                </div>
              </div>

              {/* Help section */}
              <div className="flex items-center justify-center gap-2 text-xs">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-slate-600">Cần hỗ trợ?</span>
                <button 
                  onClick={() => {
                    const subject = encodeURIComponent('Yêu cầu hỗ trợ - Xác minh phòng thi');
                    const body = encodeURIComponent(
                      'Xin chào bộ phận hỗ trợ,\n\n' +
                      'Tôi cần hỗ trợ về vấn đề xác minh phòng thi:\n\n' +
                      '[Mô tả vấn đề của bạn tại đây]\n\n' +
                      'Trân trọng.'
                    );
                    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=truongkt693@gmail.com&su=${subject}&body=${body}`, '_blank');
                  }}
                  className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-colors"
                >
                  Liên hệ ngay
                </button>
              </div>
            </div>
          </div>

          {/* Footer security badges */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="font-medium">Bảo mật SSL</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="font-medium">Mã hóa dữ liệu</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">© 2025 Online Exam, Mọi thông tin vui lòng liên hệ OEM Team</p>
          </div>
        </div>
      </div>
    </div>
  );
}
