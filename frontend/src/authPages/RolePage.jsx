import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function RolePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = location.state?.mode === "login"; // true nếu là đăng nhập

  const handleSelectRole = (role) => {
    if (isLogin) {
      // Nếu là đăng nhập
      navigate("/dang-nhap", { state: { role } });
    } else {
      // Nếu là đăng ký
      if (role === "học viên") {
        navigate("/checkin-student", { state: { role } });
      } else {
        navigate("/dang-ky-ngay", { state: { role } });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="mx-auto flex items-center justify-start px-6 py-4 w-full max-w-6xl">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <img src="/Logo.png" alt="OEM Logo" className="h-16 w-auto" />
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-20">
        <div className="bg-white w-full max-w-[450px] p-8 md:p-10 rounded-2xl shadow-md flex flex-col items-center justify-center text-center border border-gray-200 transition-all hover:shadow-lg">
          <div className="flex items-center justify-start w-full mb-6 gap-3 pl-2">
            <img
              src="/icons/UI Image/user.png"
              alt="User Icon"
              className="h-10 w-auto"
            />
            <span className="text-2xl font-semibold text-gray-700">
              Bạn là ai?
            </span>
          </div>

          <div className="flex w-full gap-4">
            <button
              onClick={() => handleSelectRole("giảng viên")}
              className="flex-1 px-8 py-3 border border-blue-500 text-blue-600 rounded-lg bg-white hover:bg-blue-50 text-lg font-semibold transition-all active:scale-95"
            >
              Giảng viên
            </button>
            <button
              onClick={() => handleSelectRole("học viên")}
              className="flex-1 px-8 py-3 border border-blue-500 text-blue-600 rounded-lg bg-white hover:bg-blue-50 text-lg font-semibold transition-all active:scale-95"
            >
              Học viên
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
