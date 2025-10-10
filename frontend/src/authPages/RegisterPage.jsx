import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

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
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState(localStorage.getItem("role") || "");

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    if (storedRole) setRole(storedRole);
    else navigate("/phan-quyen");
  }, [navigate]);

  const validate = () => {
    const newErrors = {};
    if (!form.lastName.trim()) newErrors.lastName = "Vui lòng nhập họ";
    if (!form.firstName.trim()) newErrors.firstName = "Vui lòng nhập tên";
    if (!form.email.trim()) newErrors.email = "Vui lòng nhập email";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = "Email không hợp lệ";
    if (!form.password.trim()) newErrors.password = "Vui lòng nhập mật khẩu";
    else if (form.password.length < 6)
      newErrors.password = "Mật khẩu phải ít nhất 6 ký tự";
    if (form.confirmPassword !== form.password)
      newErrors.confirmPassword = "Mật khẩu nhập lại không khớp";
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      setIsLoading(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const mockToken = "mock-jwt-token";
        localStorage.setItem("token", mockToken);

        if (role === "học viên") {
          const verifiedRoomId = localStorage.getItem("verifiedRoomId");
          if (!verifiedRoomId) {
            alert("Vui lòng xác minh mã phòng trước!");
            navigate("/verify-room");
            return;
          }
          navigate("/dashboard/hoc-vien");
        } else if (role === "giảng viên") {
          navigate("/dashboard/giang-vien");
        } else {
          navigate("/phan-quyen");
        }
      } catch (err) {
        alert("Có lỗi xảy ra khi đăng ký!");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    try {
      const token = credentialResponse.credential;
      let user;
      try {
        user = jwtDecode(token);
        console.log("Google user:", user);
      } catch (decodeError) {
        console.error("JWT decode error:", decodeError);
        alert("Lỗi khi xử lý thông tin Google!");
        setIsLoading(false);
        return;
      }

      const res = await fetch(
        "http://localhost:5000/api/auth/google-register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );

      const data = await res.json();
      if (res.ok) {
        console.log("Đăng ký Google thành công:", data);
        const { token: backendToken, role: backendRole } = data;
        localStorage.setItem("token", backendToken);
        localStorage.setItem("role", backendRole);

        if (backendRole === "học viên") {
          const verifiedRoomId = localStorage.getItem("verifiedRoomId");
          if (!verifiedRoomId) {
            alert("Vui lòng xác minh mã phòng trước!");
            navigate("/verify-room");
            return;
          }
          navigate("/dashboard/hoc-vien");
        } else if (backendRole === "giảng viên") {
          navigate("/dashboard/giang-vien");
        } else {
          navigate("/");
        }
      } else {
        const errorMessage =
          data.message || "Đăng ký Google thất bại! Vui lòng thử lại.";
        alert(errorMessage);
      }
    } catch (err) {
      console.error("Google register error:", err);
      alert("Lỗi khi đăng ký bằng Google! Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    alert("Đăng ký bằng Google thất bại! Vui lòng thử lại.");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="flex flex-col md:flex-row items-center justify-between mx-auto w-full max-w-7xl px-3 py-2 md:px-4 md:py-3 gap-2 md:gap-3">
        <img
          src="/Logo.png"
          alt="OEM Logo"
          className="h-14 md:h-20 w-auto cursor-pointer"
          onClick={() => {
            navigate("/");
          }}
        />
      </header>
      <div className="flex flex-col md:flex-row w-full max-w-6xl mx-auto my-10 shadow-lg rounded-2xl overflow-hidden bg-white">
        <div className="w-full md:w-1/2 p-6 md:p-10">
          <div className="overflow-hidden flex mb-6 rounded-full !border !border-[#a2b9ff]">
            <button
              onClick={() => navigate("/dang-ky-ngay")}
              className="flex-1 py-2 text-center !bg-[#51b9ff] !font-semibold !text-gray-900 transition-all !border-none !outline-none focus:!outline-none focus-visible:!outline-none hover:!border-none active:!border-none"
            >
              Đăng ký
            </button>
            <button
              onClick={() => navigate("/dang-nhap")}
              className="flex-1 py-2 text-center !bg-[#e2f6ff] !font-medium !text-gray-900 transition-all !border-none !outline-none focus:!outline-none focus-visible:!outline-none hover:!border-none active:!border-none"
            >
              Đăng nhập
            </button>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-red-600 mb-6 text-center uppercase">
            Đăng ký ngay
          </h3>
          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  placeholder="Họ"
                  disabled={isLoading}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-gray-800 placeholder-gray-400"
                />
                {errors.lastName && (
                  <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  placeholder="Tên"
                  disabled={isLoading}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-gray-800 placeholder-gray-400"
                />
                {errors.firstName && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.firstName}
                  </p>
                )}
              </div>
            </div>
            <div>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email"
                disabled={isLoading}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-gray-800 placeholder-gray-400"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>
            <div>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Mật khẩu"
                disabled={isLoading}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-gray-800 placeholder-gray-400"
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
            </div>
            <div>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Nhập lại mật khẩu"
                disabled={isLoading}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-gray-800 placeholder-gray-400"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="w-full py-3 !bg-blue-600 !text-white rounded-lg !hover:bg-blue-700 transition-all font-semibold mt-2 active:scale-95"
              disabled={isLoading}
            >
              {isLoading ? "Đang xử lý..." : "Đăng ký"}
            </button>
            <span className="block text-center text-gray-500 text-sm mt-3">
              Hoặc đăng ký nhanh bằng
            </span>
            <div className="flex justify-center mt-3">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                shape="pill"
                size="large"
                text="signup_with"
                disabled={isLoading}
              />
            </div>
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
