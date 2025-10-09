import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

const LoginPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false); // Thêm trạng thái loading

  const validate = () => {
    const newErrors = {};
    if (!form.email.trim()) newErrors.email = "Vui lòng nhập email";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = "Email không hợp lệ";
    if (!form.password.trim()) newErrors.password = "Vui lòng nhập mật khẩu";
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length === 0) {
      setIsLoading(true);
      alert("Đăng nhập thành công");
      sessionStorage.setItem("role", "user");
      setIsLoading(false);
      navigate("/");
    }
  };

  const handleGoogleLoginSuccess = async (credentialResponse) => {
    setIsLoading(true);
    try {
      const token = credentialResponse?.credential;
      if (!token) {
        alert("Không nhận được token từ Google!");
        setIsLoading(false);
        return;
      }

      let user;
      try {
        user = jwtDecode(token);
      } catch (decodeError) {
        console.error("JWT decode error:", decodeError);
        alert("Lỗi khi xử lý thông tin Google!");
        setIsLoading(false);
        return;
      }

      const res = await fetch("http://localhost:5000/api/auth/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (res.ok) {
        sessionStorage.setItem("googleUser", JSON.stringify(user));
        sessionStorage.setItem("role", "user");
        alert("Đăng nhập bằng Google thành công!");
        navigate("/");
      } else {
        // Xử lý lỗi cụ thể từ backend
        const errorMessage =
          data.message || "Đăng nhập bằng Google thất bại! Vui lòng thử lại.";
        alert(errorMessage);
      }
    } catch (error) {
      console.error("Lỗi đăng nhập Google:", error);
      alert("Lỗi khi đăng nhập bằng Google! Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLoginError = () => {
    alert("Đăng nhập bằng Google thất bại! Vui lòng thử lại.");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="flex flex-col md:flex-row items-center justify-between mx-auto w-full max-w-7xl px-3 py-2 md:px-4 md:py-3 gap-2 md:gap-3">
        <img
          src="/Logo.png"
          alt="OEM Logo"
          className="h-14 md:h-20 w-auto cursor-pointer"
          onClick={() => navigate("/")}
        />
      </header>

      <div className="flex flex-col md:flex-row w-full max-w-6xl mx-auto my-10 shadow-lg rounded-2xl overflow-hidden bg-white">
        <div className="w-full md:w-1/2 p-6 md:p-10">
          <div className="overflow-hidden flex mb-6 border border-[#a2b9ff] rounded-full">
            <button
              onClick={() => navigate("/dang-ky-ngay")}
              className="flex-1 py-2 text-center !bg-[#e2f6ff] !text-gray-900 !font-medium transition-all 
               !border-none !outline-none focus:!outline-none focus-visible:!outline-none 
               hover:!border-none active:!border-none"
            >
              Đăng ký
            </button>
            <button
              onClick={() => navigate("/dang-nhap")}
              className="flex-1 py-2 text-center !bg-[#51b9ff] !font-semibold !text-gray-900 
               transition-all !border-none !outline-none focus:!outline-none focus-visible:!outline-none 
               hover:!border-none active:!border-none"
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-gray-800 placeholder-gray-400"
                disabled={isLoading}
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-gray-800 placeholder-gray-400"
                disabled={isLoading}
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
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold mt-2 active:scale-95"
              disabled={isLoading}
            >
              {isLoading ? "Đang xử lý..." : "Đăng nhập"}
            </button>

            <span className="block text-center text-gray-500 text-sm mt-3">
              Hoặc đăng nhập bằng
            </span>

            <div className="flex justify-center mt-3">
              <GoogleLogin
                onSuccess={handleGoogleLoginSuccess}
                onError={handleGoogleLoginError}
                shape="pill"
                size="large"
                text="signin_with"
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

export default LoginPage;
