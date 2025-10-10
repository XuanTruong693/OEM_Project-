// xác minh mã phòng cho role học viên
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function VerifyRoom() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const role = localStorage.getItem("role");

  useEffect(() => {
    if (!role || role !== "học viên") {
      localStorage.removeItem("role");
      navigate("/phan-quyen");
    }
  }, [role, navigate]);

  const validateRoomCode = (value) => {
    const v = value.trim();
    if (!v) return "Vui lòng nhập mã phòng.";
    if (!/^[A-Za-z0-9_-]+$/.test(v)) {
      return "Mã không hợp lệ. ";
    }
    return "";
  };

  const handleVerify = async () => {
    const clientError = validateRoomCode(roomCode);
    if (clientError) {
      setError(clientError);
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get(
        `/api/exam-room/verify/${encodeURIComponent(roomCode.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
        }
      );
      if (res.data.valid) {
        localStorage.setItem("verifiedRoomId", res.data.roomId);
        navigate("/dang-ky-ngay");
      } else {
        setError("Mã phòng không hợp lệ");
      }
    } catch (err) {
      setError("Lỗi khi xác minh mã phòng");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="mx-auto flex items-center justify-start px-6 py-4 w-full max-w-6xl">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => {
            navigate("/");
          }}
        >
          <img
            src="/Logo.png"
            alt="OEM Logo"
            className="h-16 sm:h-20 md:h-24 w-auto"
          />
        </div>
      </header>
      <div className=" bg-gray-100 mt-8  flex flex-col items-center justify-center">
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
              onChange={(e) => {
                const next = e.target.value.toUpperCase();
                setRoomCode(next);
                if (error) {
                  const maybe = validateRoomCode(next);
                  if (!maybe) setError("");
                }
              }}
              onBlur={() => {
                const err = validateRoomCode(roomCode);
                if (err) setError(err);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleVerify();
                }
              }}
              maxLength={12}
              className={`w-full p-2 border rounded-md !text-gray-700 focus:outline-none !bg-white  focus:!ring-blue-400 ${
                error ? "border-red-400" : "border-gray-400"
              }`}
              placeholder="Nhập mã truy cập "
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm text-center mb-4">{error}</p>
          )}
          <button
            onClick={handleVerify}
            disabled={loading}
            className={`w-full py-2 rounded-md !text-white font-medium flex items-center justify-center gap-2 transition-colors ${
              loading
                ? "!bg-blue-300 cursor-not-allowed"
                : "!bg-blue-500 !hover:bg-blue-600"
            }`}
          >
            <img
              src="/icons/UI Image/tick.png"
              alt="Tick Icon"
              className="!h-4 sm:h-7 w-auto"
            />
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
