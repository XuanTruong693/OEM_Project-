import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";

const LoginPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(localStorage.getItem("selectedRole") || "");

  useEffect(() => {
    if (!role) navigate("/");
  }, [role, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const validate = () => {
    const newErrors = {};
    if (!form.email.trim()) newErrors.email = "Vui lòng nhập email";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = "Email không hợp lệ";
    if (!form.password.trim()) newErrors.password = "Vui lòng nhập mật khẩu";
    return newErrors;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setLoading(true);
    try {
      const payload = { ...form, role: role };
      if (role === "student")
        payload.roomId = localStorage.getItem("verifiedRoomId");
      const res = await axios.post("/api/auth/login", payload);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", role);
      navigate(`/${role === "student" ? "student" : "instructor"}-dashboard`);
    } catch (error) {
      setErrors({ general: "Đăng nhập thất bại, vui lòng kiểm tra lại" });
    }
    setLoading(false);
  };

  const handleGoogleLoginSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      const res = await axios.post("/api/auth/google-login", {
        email: decoded.email,
        role: role,
        roomId:
          role === "student" ? localStorage.getItem("verifiedRoomId") : null,
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", role);
      navigate(`/${role === "student" ? "student" : "instructor"}-dashboard`);
    } catch (error) {
      setErrors({ general: "Đăng nhập Google thất bại" });
    }
    setLoading(false);
  };

  const handleGoogleLoginError = () => {
    setErrors({ general: "Lỗi xác thực Google" });
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
              onClick={() => navigate("/register")}
              className="flex-1 py-2 text-center !bg-[#e2f6ff] !font-medium !text-gray-900 transition-all !border-none !outline-none focus:!outline-none focus-visible:!outline-none hover:!border-none active:!border-none"
            >
              Đăng ký
            </button>
            <button
              onClick={() => navigate("/login")}
              className="flex-1 py-2 text-center !bg-[#51b9ff] !font-semibold !text-gray-900 transition-all !border-none !outline-none focus:!outline-none focus-visible:!outline-none hover:!border-none active:!border-none"
            >
              Đăng nhập
            </button>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-red-600 mb-6 text-center uppercase">
            Đăng nhập
          </h3>
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email"
                disabled={loading}
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
                disabled={loading}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-gray-800 placeholder-gray-400"
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
              <div className="text-right mt-1">
                <span
                  className="text-blue-500 text-xs cursor-pointer hover:underline"
                  onClick={() => navigate("/quen-mat-khau")}
                >
                  Quên mật khẩu?
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg text-white font-semibold mt-2 active:scale-95 transition-all flex items-center justify-center gap-2 ${
                loading
                  ? "!bg-gray-400 cursor-not-allowed"
                  : "!bg-blue-600 hover:!bg-blue-700"
              }`}
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                "Đăng nhập"
              )}
            </button>
            <span className="block text-center text-gray-500 text-sm mt-3">
              Hoặc đăng nhập bằng
            </span>
            <div className="flex justify-center mt-3">
              <GoogleLogin
                onSuccess={handleGoogleLoginSuccess}
                onError={handleGoogleLoginError}
              />
            </div>
          </form>
          {errors.general && (
            <p className="text-red-500 text-sm mt-2 text-center">
              {errors.general}
            </p>
          )}
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

export default LoginPage;
