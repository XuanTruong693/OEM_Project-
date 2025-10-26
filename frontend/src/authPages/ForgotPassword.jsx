import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmed = email.toLowerCase().trim();

    // 1. Client-side validate format
    if (!emailRegex.test(trimmed)) {
      setError("Định dạng email không hợp lệ.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Lỗi server khi kiểm tra email.");
        setLoading(false);
        return;
      }

      if (!data.exists) {
        setError("Email này chưa được đăng ký trong hệ thống.");
        setLoading(false);
        return;
      }

      if (data.exists) {
        const otpRes = await fetch("/api/auth/forgot-send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        });

        const otpData = await otpRes.json();
        if (!otpRes.ok) {
          setError(otpData.message || "Không thể gửi mã xác thực.");
          setLoading(false);
          return;
        }
        navigate("/verify-email", {
          state: { email: trimmed, action: "forgot" },
        });
      }
    } catch (err) {
      console.error("Error checking email:", err);
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="flex flex-col md:flex-row items-center justify-between mx-auto w-full max-w-7xl px-3 py-2 md:px-4 md:py-3 gap-2 md:gap-3">
        <img
          src="/Logo.png"
          alt="OEM Logo"
          className="h-14 md:h-20 w-auto cursor-pointer"
          onClick={() => navigate("/")}
        />
      </header>

      <div className="flex flex-col md:flex-row w-full max-w-6xl mx-auto my-10 shadow-lg rounded-2xl overflow-hidden bg-white min-h-[80vh]">
        <div className="flex flex-1 items-center justify-center px-8 md:px-16 lg:px-24">
          <div className="w-full max-w-lg flex flex-col justify-center min-h-[520px]">
            <h3 className="text-3xl font-bold text-gray-800 text-center mb-4 uppercase tracking-wide">
              Đặt lại mật khẩu
            </h3>
            <p className="text-gray-500 text-center mb-4 text-base">
              Nhập email đã đăng ký để nhận mã xác thực.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <input
                type="email"
                placeholder="Email đã đăng ký"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none text-base"
                required
                disabled={loading}
              />

              {error && <div className="text-sm text-red-500">{error}</div>}

              <button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition duration-200 text-base disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Đang kiểm tra..." : "Gửi mã xác thực"}
              </button>
            </form>

            <p
              onClick={() => navigate("/login")}
              className="text-center text-blue-500 text-sm mt-8 cursor-pointer hover:underline"
            >
              Quay lại Đăng Nhập
            </p>
          </div>
        </div>

        <div className="hidden md:flex w-1/2 items-center justify-center relative">
          <div className="w-100 h-100 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center shadow-inner">
            <img
              src="/icons/UI Image/item login,rgs.png"
              alt="Illustration"
              className="w-70 h-auto drop-shadow-lg transition-transform duration-500 hover:scale-105"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
