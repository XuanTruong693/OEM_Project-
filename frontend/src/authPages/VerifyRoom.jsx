import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

export default function VerifyRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const role = localStorage.getItem("selectedRole");

  useEffect(() => {
    if (!role || role !== "student") {
      navigate("/");
    }
  }, [role, navigate]);

  const handleVerify = async () => {
    if (!roomCode.trim()) {
      setError("Vui lòng nhập mã phòng");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // ✅ FIX: Đổi URL khớp BE "/verify/:code"
      const res = await axios.get(`/api/auth/verify/${roomCode}`);
      if (res.data.valid) {
        localStorage.setItem("verifiedRoomId", res.data.roomId);
        const nextPath = location.state?.fromRoleSelection
          ? "/login"
          : localStorage.getItem("isLoginMode") === "true"
          ? "/login"
          : "/register";
        navigate(nextPath, {
          state: {
            role,
            verifiedRoomId: res.data.roomId,
            fromRoleSelection: location.state?.fromRoleSelection,
          },
        });
      } else {
        setError(res.data.message || "Mã phòng không hợp lệ");
      }
    } catch (error) {
      setError(
        error.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại"
      );
    }
    setLoading(false);
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

      <div className="bg-gray-100 mt-8 flex flex-col items-center justify-center">
        <div className="bg-white w-full max-w-[400px] p-6 rounded-lg shadow-md border border-gray-300">
          <div className="mb-6 flex items-center justify-center gap-4">
            <div className="!w-14 !h-14 sm:w-20 sm:h-20 rounded-full bg-[#C0D9EB] flex items-center justify-center shadow-md border border-blue-200">
              <img
                src="/icons/UI Image/lock.png"
                alt="Lock Icon"
                className="h-8 sm:h-10 w-auto object-contain"
              />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-700">
              Truy cập phần thi
            </h2>
          </div>

          <div className="mb-4 p-4 bg-[#C0D9EB] rounded-lg border border-blue-200">
            <span className="block text-sm font-medium text-gray-600 mb-2">
              Mã truy cập vào phần thi
            </span>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleVerify();
              }}
              maxLength={12}
              className="w-full p-2 border rounded-md !text-gray-700 focus:outline-none !bg-white focus:!ring-blue-400 border-gray-400"
              placeholder="Nhập mã truy cập"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center mb-4">{error}</p>
          )}

          <button
            onClick={handleVerify}
            disabled={loading || !roomCode.trim()}
            className={`w-full py-2 rounded-md !text-white font-medium flex items-center justify-center gap-2 transition-all ${
              loading || !roomCode.trim()
                ? "!bg-blue-300 cursor-not-allowed"
                : "!bg-blue-500 !hover:bg-blue-600 active:scale-95"
            }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Đang xác nhận...</span>
              </>
            ) : (
              <>
                <img
                  src="/icons/UI Image/tick.png"
                  alt="Tick Icon"
                  className="!h-4 sm:h-7 w-auto"
                />
                Xác nhận
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
