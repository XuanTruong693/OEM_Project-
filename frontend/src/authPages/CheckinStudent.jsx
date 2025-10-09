import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Check } from "lucide-react";

export default function CheckinStudent() {
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const role = location.state?.role || "học viên";

  const handleSubmit = (e) => {
    e.preventDefault();

    if (roomCode.trim() === "") {
      alert("Vui lòng nhập mã truy cập phần thi!");
      return;
    }

    // Sau này bạn có thể gọi API kiểm tra mã phòng thi tại đây
    navigate("/dang-ky-ngay", { state: { role, roomCode } });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* ===== HEADER có logo ===== */}
      <header className="mx-auto flex items-center justify-start px-6 py-4 w-full max-w-6xl">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <img
            src="/Logo.png"
            alt="OEM Logo"
            className="h-16 w-auto"
          />
        </div>
      </header>

      {/* ===== NỘI DUNG CHÍNH ===== */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <div className="bg-white w-full max-w-xl rounded-2xl shadow-sm border border-gray-300 p-10 flex flex-col items-center">
          {/* Tiêu đề */}
          <div className="flex flex-col items-center mb-6">
            <div className="bg-blue-100 rounded-full p-3 mb-3">
              <img
                src="/icons/UI Image/lock.png"
                alt="Lock"
                className="h-8 w-8"
              />
            </div>
            <h1 className="text-3xl font-semibold text-gray-700 text-center">
              Truy cập phần thi
            </h1>
          </div>

          {/* Form nhập mã */}
          <form
            onSubmit={handleSubmit}
            className="w-full bg-blue-100 rounded-2xl p-6 flex flex-col gap-4"
          >
            <label
              htmlFor="roomCode"
              className="text-gray-800 text-sm font-semibold"
            >
              Mã truy cập phần thi
            </label>

            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Nhập mã truy cập phần thi"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none text-gray-700 placeholder-gray-400"
            />

            <button
              type="submit"
              className="mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-400 text-white font-semibold py-2 px-6 rounded-lg hover:from-blue-600 hover:to-blue-500 transition-all active:scale-95"
            >
              <Check size={20} />
              Xác Nhận
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
