import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import axiosClient from "../api/axiosClient";
import LoadingSpinner from "../components/LoadingSpinner";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMaxAttemptsModal, setShowMaxAttemptsModal] = useState(false);
  const [maxAttemptsInfo, setMaxAttemptsInfo] = useState(null);
  const role = localStorage.getItem("selectedRole") || "";
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fromRoleSelection = location.state?.fromRoleSelection;

    // Nếu đã đăng nhập thì chuyển thẳng vào dashboard
    if (!fromRoleSelection) {
      const token = localStorage.getItem("token");
      const userRole = localStorage.getItem("role");
      if (token && userRole) {
        const dashboardPath = userRole === "student"
          ? "/student-dashboard"
          : userRole === "admin"
            ? "/admin-dashboard"
            : "/instructor-dashboard";
        navigate(dashboardPath);
        return;
      }
    }

    if (!role) {
      navigate("/role");
    } else if (role === "student") {
      const verifiedRoomId = localStorage.getItem("verifiedRoomId");
      if (!verifiedRoomId) navigate("/verify-room");
    }
  }, [role, navigate, location.state]);

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

  // --- Login thường ---
  const handleLogin = async (e) => {
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
      }

      console.log("[DEV] 🚀 Gửi request đăng nhập với payload:", payload);

      const res = await axiosClient.post("/auth/login", payload);

      console.log("[DEV] ✅ Đăng nhập thành công:", res.data);

      setSuccess("🎉 Đăng nhập thành công! Đang chuyển hướng...");

      setTimeout(() => {
        localStorage.setItem("token", res.data.token);
        if (res.data.refreshToken) {
          localStorage.setItem("refreshToken", res.data.refreshToken);
        }
        localStorage.setItem("role", res.data.user.role);
        localStorage.setItem(
          "fullname",
          res.data.user.full_name || "Người dùng"
        );
        localStorage.setItem(
          "avatar",
          res.data.user.avatar || "/icons/UI Image/default-avatar.png"
        );

        const userRole = res.data.user.role;
        // If student came from /join with room_token, auto-join and go to prepare
        if (userRole === 'student') {
          const roomToken = sessionStorage.getItem('room_token');
          const pendingExam = sessionStorage.getItem('pending_exam_id');
          if (roomToken && pendingExam) {
            (async () => {
              try {
                const j = await axiosClient.post('/exams/join', { room_token: roomToken });
                const sid = j.data?.submission_id;
                if (sid) {
                  try { sessionStorage.setItem('exam_flags', JSON.stringify(j.data?.flags || {})); } catch (e) { }
                  navigate(`/exam/${j.data.exam_id}/prepare?submission_id=${sid}`);
                  return;
                }
              } catch (e) { }
              navigate('/student-dashboard');
            })();
            return;
          }
        }
        const dashboardPath = userRole === "admin"
          ? "/admin-dashboard"
          : userRole === "instructor"
            ? "/instructor-dashboard"
            : "/student-dashboard";
        navigate(dashboardPath);
      }, 1500);
    } catch (error) {
      console.error("❌ [Login Error] Chi tiết lỗi đầy đủ:", error);

      // Log chi tiết hơn từng phần để biết nguyên nhân
      if (error.response) {
        console.error("📩 [Server Response]:", error.response.data);
        console.error("🔢 [Status Code]:", error.response.status);
        console.error("📡 [Headers]:", error.response.headers);

        // Xử lý lỗi 403 - Hết lượt thi
        if (error.response.status === 403 && error.response.data?.reason === 'max_attempts_exceeded') {
          console.warn(`[Login] 🚫 Hết lượt thi: ${error.response.data.current_attempts}/${error.response.data.max_attempts}`);

          // Lưu token và thông tin user vào localStorage
          if (error.response.data.token) {
            localStorage.setItem("token", error.response.data.token);
            localStorage.setItem("role", error.response.data.user.role);
            localStorage.setItem("fullname", error.response.data.user.full_name || "Người dùng");
          }

          // Hiển thị modal hết lượt thi
          setMaxAttemptsInfo(error.response.data);
          setShowMaxAttemptsModal(true);
          setLoading(false);
          return;
        }

        // Xử lý lỗi 403 - Sai quyền (Role mismatch)
        if (error.response.status === 403 && error.response.data?.requiredRole) {
          console.warn(`[Login] ⛔ Role mismatch: required=${error.response.data.requiredRole}, current=${error.response.data.currentRole}`);
          setErrors({
            general: `⛔ ${error.response.data.message || 'Đăng nhập sai quyền'}. Hệ thống yêu cầu role: ${error.response.data.requiredRole}`,
          });
          setSuccess("");
          setLoading(false);
          return;
        }
      } else if (error.request) {
        console.error("📭 [No Response từ Server]:", error.request);
      } else {
        console.error("⚠️ [Error Message]:", error.message);
      }

      setErrors({
        general:
          error.response?.data?.message ||
          "Đăng nhập thất bại, vui lòng thử lại.",
      });
      setSuccess("");
    } finally {
      setLoading(false);
    }
  };

  // --- Google login ---
  const handleGoogleLoginSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setErrors({ general: "Không nhận được Google credential" });
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccess("");

    try {
      const payload = {
        idToken: credentialResponse.credential,
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
      }

      console.log("[DEV] Google login payload gửi backend:", payload);
      const res = await axiosClient.post("/auth/google", payload);
      console.log("[DEV] ✅ Google login thành công:", res.data);

      setSuccess("🎉 Đăng nhập Google thành công! Đang chuyển hướng...");

      setTimeout(() => {
        localStorage.setItem("token", res.data.token);
        if (res.data.refreshToken) {
          localStorage.setItem("refreshToken", res.data.refreshToken);
        }
        localStorage.setItem("role", res.data.user.role);
        localStorage.setItem(
          "fullname",
          res.data.user.full_name || "Người dùng"
        );
        localStorage.setItem(
          "avatar",
          res.data.user.avatar || "/icons/UI Image/default-avatar.png"
        );

        const userRole = res.data.user.role;
        if (userRole === 'student') {
          // Nếu đến từ /verify-room và đã có room_token → auto join và chuyển thẳng vào prepare
          const roomToken = sessionStorage.getItem('room_token');
          const pendingExam = sessionStorage.getItem('pending_exam_id');
          if (roomToken && pendingExam) {
            (async () => {
              try {
                const j = await axiosClient.post('/exams/join', { room_token: roomToken });
                const sid = j.data?.submission_id;
                if (sid) {
                  try { sessionStorage.setItem('exam_flags', JSON.stringify(j.data?.flags || {})); } catch (e) { }
                  navigate(`/exam/${j.data.exam_id}/prepare?submission_id=${sid}`);
                  return;
                }
              } catch (e) { /* fallthrough */ }
              navigate('/student-dashboard');
            })();
            return;
          }
        }

        const dashboardPath = userRole === "admin"
          ? "/admin-dashboard"
          : userRole === "instructor"
            ? "/instructor-dashboard"
            : "/student-dashboard";
        navigate(dashboardPath);
      }, 800);
    } catch (error) {
      console.error("❌ Lỗi Google login:", error?.response?.data || error);

      // Xử lý lỗi 403 - Hết lượt thi
      if (error.response?.status === 403 && error.response?.data?.reason === 'max_attempts_exceeded') {
        console.warn(`[Google Login] 🚫 Hết lượt thi: ${error.response.data.current_attempts}/${error.response.data.max_attempts}`);

        // Lưu token và thông tin user vào localStorage
        if (error.response.data.token) {
          localStorage.setItem("token", error.response.data.token);
          localStorage.setItem("role", error.response.data.user.role);
          localStorage.setItem("fullname", error.response.data.user.full_name || "Người dùng");
        }

        // Hiển thị modal hết lượt thi
        setMaxAttemptsInfo(error.response.data);
        setShowMaxAttemptsModal(true);
        setLoading(false);
        return;
      }

      // Xử lý lỗi 403 - Sai quyền (Role mismatch)
      if (error.response?.status === 403 && error.response?.data?.requiredRole) {
        console.warn(`[Google Login] ⛔ Role mismatch: required=${error.response.data.requiredRole}, current=${error.response.data.currentRole}`);
        setErrors({
          general: `⛔ ${error.response.data.message || 'Đăng nhập sai quyền'}. Hệ thống yêu cầu role: ${error.response.data.requiredRole}`,
        });
      } else {
        setErrors({
          general: error.response?.data?.message || "Đăng nhập Google thất bại",
        });
      }
      setSuccess("");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLoginError = () => {
    console.error("⚠️ Lỗi xác thực Google");
    setErrors({ general: "Lỗi xác thực Google" });
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
              onClick={() => navigate("/register")}
              className="flex-1 py-2 text-center bg-[#e2f6ff] font-medium text-gray-900"
            >
              Đăng ký
            </button>
            <button
              onClick={() => navigate("/login")}
              className="flex-1 py-2 text-center bg-[#51b9ff] font-semibold text-gray-900"
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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Mật khẩu"
                  disabled={loading}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-gray-800 placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.97 9.97 0 013.293.546M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
              <div className="text-right mt-1">
                <span
                  className="text-blue-500 text-xs cursor-pointer hover:underline"
                  onClick={() => navigate("/forgot-password")}
                >
                  Quên mật khẩu?
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg text-white font-semibold mt-2 active:scale-95 transition-all flex items-center justify-center gap-2 ${loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
                }`}
            >
              {loading ? (
                <LoadingSpinner size="sm" text="Đang đăng nhập..." />
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

          {success && (
            <p className="text-green-600 text-sm mt-2 text-center font-medium">
              {success}
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

      {/* Modal hết lượt thi */}
      {showMaxAttemptsModal && maxAttemptsInfo && (
        <div className="fixed inset-0 bg-white 100 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform transition-all">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Đã hết lượt thi</h2>
              <p className="text-gray-600 text-sm mb-4">
                {maxAttemptsInfo.message}
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Bài thi:</span>
                <span className="text-sm font-semibold text-gray-800">
                  {maxAttemptsInfo.exam_title || `Bài thi #${maxAttemptsInfo.exam_id}`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Số lần đã thi:</span>
                <span className="text-sm font-semibold text-red-600">
                  {maxAttemptsInfo.current_attempts}/{maxAttemptsInfo.max_attempts}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMaxAttemptsModal(false);
                  navigate('/');
                }}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Về trang chủ
              </button>
              <button
                onClick={() => {
                  setShowMaxAttemptsModal(false);
                  navigate('/student-dashboard');
                }}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                Vào Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
