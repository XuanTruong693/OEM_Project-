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
    // Không tự động redirect, để user có thể chọn role mới
    // Chỉ xóa selectedRole nếu đã đăng nhập
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
      // 1. POST role lên backend để set appRole (gửi trực tiếp /role, không có /api)
      console.log(`[RolePage] 📤 POST role ${selectedRole} to backend...`);
      const response = await axios.post("http://localhost:5000/role", { role: selectedRole });
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

          {error && (
            <div className="w-full mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex w-full gap-4">
            <button
              onClick={() => handleSelectRole("instructor")}
              disabled={loading}
              className="flex-1 px-8 py-3 border !border-blue-500 !text-blue-600 rounded-lg !bg-white 
             !hover:bg-blue-50 !text-lg !sm:text-xl !font-semibold transition-all active:scale-95 
             active:!border-blue-700 focus:!border-blue-700  focus:!ring-blue-300 
             focus:!outline-none active:!outline-none"
            >
              {loading ? "Đang xử lý..." : "Instructor"}
            </button>

            <button
              onClick={() => handleSelectRole("student")}
              disabled={loading}
              className="flex-1 px-8 py-3 border !border-blue-500 !text-blue-600 rounded-lg !bg-white 
             !hover:bg-blue-50 !text-lg !sm:text-xl !font-semibold transition-all active:scale-95 
             active:!border-blue-700 focus:!border-blue-700  focus:!ring-blue-300 
             focus:!outline-none active:!outline-none"
            >
              {loading ? "Đang xử lý..." : "Student"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
