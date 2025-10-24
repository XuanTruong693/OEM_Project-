import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import axiosClient from "../api/axiosClient";
import LoadingSpinner from "../components/LoadingSpinner";

const RegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const role = localStorage.getItem("selectedRole") || "";

  // --- Kiểm tra role + roomId ---
  useEffect(() => {
    if (!role) navigate("/role");
    else if (role === "student") {
      const verifiedRoomId = localStorage.getItem("verifiedRoomId");
      if (!verifiedRoomId) navigate("/verify-room");
    }
  }, [role, navigate]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const validate = () => {
    const newErrors = {};
    if (!form.lastName.trim()) newErrors.lastName = "Vui lòng nhập họ";
    if (!form.firstName.trim()) newErrors.firstName = "Vui lòng nhập tên";
    if (!form.email.trim()) newErrors.email = "Vui lòng nhập email";
    else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(form.email))
      newErrors.email = "Định dạng email không hợp lệ";
    if (!form.password.trim()) newErrors.password = "Vui lòng nhập mật khẩu";
    else if (form.password.length < 6)
      newErrors.password = "Mật khẩu phải ít nhất 6 ký tự";
    if (form.confirmPassword !== form.password)
      newErrors.confirmPassword = "Mật khẩu nhập lại không khớp";
    return newErrors;
  };

  // --- Đăng ký thường ---
  const handleRegister = async (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSuccess("");
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccess("");

    try {
      const payload = {
        full_name: `${form.lastName} ${form.firstName}`.trim(),
        email: form.email,
        password: form.password,
        role,
      };

      if (role === "student") {
        const roomId = localStorage.getItem("verifiedRoomId");
        if (!roomId) {
          setErrors({
            general: "Không tìm thấy mã phòng thi. Vui lòng xác thực lại.",
          });
          setLoading(false);
          return;
        }
        payload.roomId = roomId;
        console.log("[DEV] Register payload:", payload);
      }

      const res = await axiosClient.post("/auth/register", payload);
      console.log("[DEV] Register success:", res.data);
      setSuccess("🎉 Đăng ký thành công! Đang chuyển hướng...");

      setTimeout(() => {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("role", res.data.user.role);
        navigate(`/${role === "student" ? "student" : "instructor"}-dashboard`);
      }, 1500);
    } catch (error) {
      console.error("❌ Register error:", error);
      setErrors({
        general: error.response?.data?.message || "Đăng ký thất bại",
      });
    } finally {
      setLoading(false);
    }
  };

  // --- Google Register ---
  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setErrors({ general: "Không nhận được Google credential" });
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccess("");

    try {
      const payload = { idToken: credentialResponse.credential, role };
      if (role === "student") {
        const roomId = localStorage.getItem("verifiedRoomId");
        if (!roomId) {
          setErrors({
            general: "Không tìm thấy mã phòng thi. Vui lòng xác thực lại.",
          });
          setLoading(false);
          return;
        }
        payload.roomId = roomId;
      }

      console.log("[DEV] Google register payload:", payload);
      const res = await axiosClient.post("/auth/google", payload);
      console.log("[DEV] Google register response:", res.data);
      setSuccess("🎉 Đăng ký Google thành công! Đang chuyển hướng...");

      setTimeout(() => {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("role", res.data.user.role);
        navigate(`/${role === "student" ? "student" : "instructor"}-dashboard`);
      }, 1500);
    } catch (error) {
      console.error("❌ Google register error:", error);
      setErrors({
        general: error.response?.data?.message || "Đăng ký Google thất bại",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setErrors({ general: "Lỗi xác thực Google" });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="flex flex-col md:flex-row items-center justify-between mx-auto w-full max-w-7xl px-3 py-2 gap-2 md:gap-3">
        <img
          src="/Logo.png"
          alt="OEM Logo"
          className="h-14 md:h-20 w-auto cursor-pointer"
          onClick={() => navigate("/")}
        />
      </header>

      <div className="flex flex-col md:flex-row w-full max-w-6xl mx-auto my-10 shadow-lg rounded-2xl overflow-hidden bg-white">
        <div className="w-full md:w-1/2 p-6 md:p-10">
          <div className="overflow-hidden flex mb-6 rounded-full border border-[#a2b9ff]">
            <button
              onClick={() => navigate("/register")}
              className="flex-1 py-2 text-center bg-[#51b9ff] font-semibold text-gray-900"
            >
              Đăng ký
            </button>
            <button
              onClick={() => navigate("/login")}
              className="flex-1 py-2 text-center bg-[#e2f6ff] font-medium text-gray-900"
            >
              Đăng nhập
            </button>
          </div>

          <h3 className="text-2xl md:text-3xl font-bold text-red-600 mb-6 text-center uppercase">
            Đăng ký ngay
          </h3>

          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-400"
                name="lastName"
                placeholder="Họ"
                value={form.lastName}
                onChange={handleChange}
                disabled={loading}
              />
              <input
                className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-400"
                name="firstName"
                placeholder="Tên"
                value={form.firstName}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              disabled={loading}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400"
            />
            <input
              type="password"
              name="password"
              placeholder="Mật khẩu"
              value={form.password}
              onChange={handleChange}
              disabled={loading}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400"
            />
            <input
              type="password"
              name="confirmPassword"
              placeholder="Nhập lại mật khẩu"
              value={form.confirmPassword}
              onChange={handleChange}
              disabled={loading}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center"
            >
              {loading ? (
                <LoadingSpinner size="sm" text="Đang xử lý..." />
              ) : (
                "Đăng ký"
              )}
            </button>

            <span className="block text-center text-gray-500 text-sm mt-3">
              Hoặc đăng ký nhanh bằng
            </span>
            <div className="flex justify-center mt-3">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
              />
            </div>

            {errors.general && (
              <p className="text-red-500 text-sm mt-2 text-center">
                {errors.general}
              </p>
            )}
            {success && (
              <p className="text-green-600 text-sm mt-2 text-center font-medium">
                {success}
              </p>
            )}
          </form>
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

export default RegisterPage;
