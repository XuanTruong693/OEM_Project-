import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

export default function RolePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = location.state?.mode === "login";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      localStorage.removeItem("selectedRole");
    }
  }, []);

  const handleSelectRole = async (role) => {
    setLoading(true);
    setError("");
    const selectedRole = role;

    try {
      // 1. POST role lên backend để set appRole
      const serverUrl = import.meta.env.VITE_SERVER_URL || '';
      console.log(`[RolePage] 📤 POST role ${selectedRole} to backend...`);
      const response = await axios.post(`${serverUrl}/role`, { role: selectedRole });
      console.log(`[RolePage] ✅ Backend confirmed role:`, response.data);

      // 2. Xóa tất cả dữ liệu cũ khi chọn role mới
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("verifiedRoomId");
      localStorage.removeItem("verifiedRoomCode");

      // 3. Lưu role vào localStorage
      localStorage.setItem("selectedRole", selectedRole);

      if (selectedRole === "instructor") {
        navigate("/login", {
          state: { role: selectedRole, fromRoleSelection: true },
        });
      } else {
        navigate("/verify-room", {
          state: { role: selectedRole, fromRoleSelection: true },
        });
      }
    } catch (error) {
      console.error("[RolePage] ❌ Lỗi chọn role:", error);
      setError("Lỗi khi cập nhật role. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
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

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          {/* Card */}
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 overflow-hidden">
            {/* Header section */}
            <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 px-8 py-6 text-center overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12 blur-2xl"></div>

              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white backdrop-blur-xl mb-3 border-2 border-white/40 shadow-2xl overflow-hidden">
                  <img
                    src="/icons/UI Image/user.png"
                    alt="User Icon"
                    className="w-14 h-14 object-contain filter brightness-110 contrast-110"
                  />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1.5 drop-shadow-md">Chọn Vai Trò</h2>
                <p className="text-blue-50 text-xs font-medium">Vui lòng chọn vai trò của bạn để tiếp tục</p>
              </div>
            </div>

            {/* Form section */}
            <div className="px-8 py-8">
              {/* Error message */}
              {error && (
                <div className="mb-6 p-4 bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200 rounded-2xl flex gap-3 animate-shake shadow-sm">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-900 mb-0.5">Có lỗi xảy ra</p>
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {/* Role buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Instructor button */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-gradient-border blur"></div>
                  <button
                    onClick={() => handleSelectRole("instructor")}
                    disabled={loading}
                    className="relative w-full overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl p-6 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-2xl hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10 flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-1">Instructor</h3>
                        <p className="text-blue-100 text-xs">Giảng viên</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Student button */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-gradient-border blur"></div>
                  <button
                    onClick={() => handleSelectRole("student")}
                    disabled={loading}
                    className="relative w-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl p-6 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-2xl hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10 flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-1">Student</h3>
                        <p className="text-purple-100 text-xs">Sinh viên</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Loading state */}
              {loading && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm font-medium text-blue-900">Đang xử lý...</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-600">
              🔒 Thông tin của bạn được bảo mật tuyệt đối
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
