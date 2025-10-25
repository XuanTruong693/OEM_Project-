import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || "";
  const [otp, setOtp] = useState(["", "", "", "", "", ""]); // ✅ 6 ký tự
  const [timer, setTimer] = useState(60);
  const [message, setMessage] = useState("");
  const inputsRef = useRef([]);

  // Đếm ngược 60s
  useEffect(() => {
    if (timer > 0) {
      const countdown = setTimeout(() => setTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(countdown);
    }
  }, [timer]);

  // ✅ Xử lý nhập từng ký tự
  const handleChange = (e, index) => {
    const value = e.target.value.replace(/\D/g, ""); // chỉ cho phép số
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < otp.length - 1) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newOtp = [...otp];

      if (otp[index]) {
        newOtp[index] = "";
        setOtp(newOtp);
      } else if (index > 0) {
        inputsRef.current[index - 1].focus();
        newOtp[index - 1] = "";
        setOtp(newOtp);
      }
    }
  };

  // ✅ Gửi xác minh OTP
  const handleVerify = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setMessage("Vui lòng nhập đủ 6 số OTP");
      return;
    }

    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/verify-otp",
        { email, otp: code }
      );

      if (res.data.status === "success") {
        setMessage("✅ Xác minh thành công!");
        setTimeout(
          () => navigate("/reset-password", { state: { email } }),
          1000
        );
      } else {
        setMessage("❌ Mã OTP không hợp lệ hoặc đã hết hạn");
      }
    } catch (err) {
      setMessage("⚠️ Lỗi xác minh OTP");
      console.error(err);
    }
  };

  // ✅ Gửi lại OTP
  const handleResend = async () => {
    if (timer > 0) return;
    try {
      await axios.post("http://localhost:5000/api/auth/forgot-send-otp", {
        email,
      });
      setTimer(60);
      setMessage("✅ Mã OTP mới đã được gửi lại!");
      setOtp(["", "", "", "", "", ""]);
      inputsRef.current[0].focus();
    } catch (err) {
      console.error(err);
      setMessage("❌ Gửi lại OTP thất bại");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          You’ve Got Email
        </h2>
        <p className="text-gray-500 mb-6">
          We’ve sent the OTP verification code to your email address.
          <br /> Please check your email and enter the code below.
        </p>

        <div className="flex justify-center gap-3 mb-6">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputsRef.current[index] = el)}
              type="text"
              maxLength="1"
              value={digit}
              onChange={(e) => handleChange(e, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className="w-12 h-12 text-center text-xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ))}
        </div>

        <p
          onClick={handleResend}
          className={`text-sm ${
            timer > 0
              ? "text-gray-400"
              : "text-indigo-600 cursor-pointer hover:underline"
          } mb-4`}
        >
          {timer > 0 ? `You can resend code in ${timer}s` : "Resend code"}
        </p>

        <button
          onClick={handleVerify}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Confirm
        </button>

        {message && <p className="text-sm text-gray-700 mt-4">{message}</p>}

        <button
          onClick={() => navigate("/login")}
          className="text-indigo-600 text-sm mt-4 hover:underline"
        >
          Back to Sign In
        </button>
      </div>
    </div>
  );
};

export default VerifyEmail;
