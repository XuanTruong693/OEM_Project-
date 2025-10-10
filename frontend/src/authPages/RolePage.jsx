import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function RolePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = location.state?.mode === "login";
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    if (storedRole) {
      if (storedRole === "học viên") navigate("/verify-room");
      else
        navigate(
          storedRole === "giảng viên" && isLogin
            ? "/dang-nhap"
            : "/dang-ky-ngay"
        );
    }

    // 👇 Khi rời khỏi trang phân quyền (unmount), nếu người dùng chưa điều hướng hợp lệ => xóa role
    return () => {
      const currentPath = window.location.pathname;
      // Nếu người dùng không đi đến 3 trang hợp lệ => xóa role
      const allowedPaths = ["/verify-room", "/dang-nhap", "/dang-ky-ngay"];
      if (!allowedPaths.includes(currentPath)) {
        localStorage.removeItem("role");
      }
    };
  }, [navigate, isLogin]);

  const handleSelectRole = (role) => {
    if (!localStorage.getItem("role")) {
      setLoading(true);
      localStorage.setItem("role", role);
      if (role === "học viên") {
        navigate("/verify-room", { state: { role, fromRoleSelection: true } });
      } else if (role === "giảng viên") {
        navigate(isLogin ? "/dang-nhap" : "/dang-ky-ngay", {
          state: { role, fromRoleSelection: true },
        });
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="mx-auto flex items-center justify-start px-6 py-4 w-full max-w-6xl">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <img
            src="/Logo.png"
            alt="OEM Logo"
            className="h-16 sm:h-20 md:h-24 w-auto"
          />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-20">
        <div className="bg-white w-full max-w-[450px] p-8 md:p-10 rounded-2xl shadow-md flex flex-col items-center justify-center text-center border border-gray-200 transition-all hover:shadow-lg">
          <div className="flex items-center justify-start w-full mb-6 gap-3 pl-2">
            <img
              src="/icons/UI Image/user.png"
              alt="User Icon"
              className="h-10 sm:h-12 w-auto"
            />
            <span className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-700">
              Bạn là ai?
            </span>
          </div>

          <div className="flex w-full gap-4">
            <button
              onClick={() => handleSelectRole("giảng viên")}
              disabled={loading}
              className="flex-1 px-8 py-3 border !border-blue-500 !text-blue-600 rounded-lg !bg-white 
             !hover:bg-blue-50 !text-lg !sm:text-xl !font-semibold transition-all active:scale-95 
             active:!border-blue-700 focus:!border-blue-700  focus:!ring-blue-300 
             focus:!outline-none active:!outline-none"
            >
              {loading ? "Đang xử lý..." : "Giảng viên"}
            </button>

            <button
              onClick={() => handleSelectRole("học viên")}
              disabled={loading}
              className="flex-1 px-8 py-3 border !border-blue-500 !text-blue-600 rounded-lg !bg-white 
             !hover:bg-blue-50 !text-lg !sm:text-xl !font-semibold transition-all active:scale-95 
             active:!border-blue-700 focus:!border-blue-700  focus:!ring-blue-300 
             focus:!outline-none active:!outline-none"
            >
              {loading ? "Đang xử lý..." : "Học viên"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
