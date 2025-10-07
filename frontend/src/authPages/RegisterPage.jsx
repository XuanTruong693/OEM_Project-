import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

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

  const handleRegister = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length === 0) {
      alert("Đăng ký thành công 🎉");
      navigate("/dang-nhap");
    }
  };

  const handleGoogleLogin = () => {
    alert("Đăng nhập bằng Google");
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
          <div className="overflow-hidden flex mb-6 rounded-full border border-[#a2b9ff]">
            <button
              onClick={() => navigate("/dang-ky-ngay")}
              className="flex-1 py-2 text-center !bg-[#51b9ff] !font-semibold !text-gray-900 
               transition-all !border-none !outline-none focus:!outline-none 
               focus-visible:!outline-none hover:!border-none active:!border-none"
            >
              Đăng ký
            </button>
            <button
              onClick={() => navigate("/dang-nhap")}
              className="flex-1 py-2 text-center !bg-[#e2f6ff] !font-medium !text-gray-900 
               transition-all !border-none !outline-none focus:!outline-none 
               focus-visible:!outline-none hover:!border-none active:!border-none"
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
                  className="w-full p-3 border !border-gray-300 rounded-lg focus:!ring-2 focus:!ring-blue-400 focus:!border-blue-400 outline-none !text-gray-800 placeholder-gray-400"
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
                  className="w-full p-3 border !border-gray-300 rounded-lg focus:!ring-2 focus:!ring-blue-400 focus:!border-blue-400 outline-none !text-gray-800 placeholder-gray-400"
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
                className="w-full p-3 border !border-gray-300 rounded-lg focus:!ring-2 focus:!ring-blue-400 focus:!border-blue-400 outline-none !text-gray-800 placeholder-gray-400"
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
                className="w-full p-3 border !border-gray-300 rounded-lg focus:!ring-2 focus:!ring-blue-400 focus:!border-blue-400 outline-none !text-gray-800 placeholder-gray-400"
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
                className="w-full p-3 border !border-gray-300 rounded-lg focus:!ring-2 focus:!ring-blue-400 focus:!border-blue-400 outline-none !text-gray-800 placeholder-gray-400"
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
            >
              Đăng ký
            </button>

            <span className="block text-center text-gray-500 text-sm mt-3">
              Hoặc đăng ký bằng
            </span>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-auto mx-auto mt-3 py-2 px-6 !bg-white border !border-gray-300 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-100 transition-all active:scale-95"
            >
              <img
                src="https://www.google.com/favicon.ico"
                alt="Google"
                className="h-6 w-6"
              />
              <span className="!text-blue-600 text-base font-medium">
                Google
              </span>
            </button>
          </form>
        </div>

        <div className="hidden md:flex w-1/2 items-center justify-center relative">
          <div className="w-100 h-100 !bg-gradient-to-br !from-blue-100 !to-blue-200 rounded-full flex items-center justify-center shadow-inner">
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
