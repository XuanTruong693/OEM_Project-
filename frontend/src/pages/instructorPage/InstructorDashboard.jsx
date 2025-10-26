import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { FiLogOut } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import axiosClient from "../../api/axiosClient";

const InstructorDashboard = () => {
  const navigate = useNavigate();

  // 🧠 State
  const [stats, setStats] = useState({
    total_exams_created: 0,
    total_tests_submitted: 0,
    total_students_participated: 0,
  });
  const [monthlyData, setMonthlyData] = useState([]);
  const [userInfo, setUserInfo] = useState({
    fullname: "Giảng viên",
    avatar: "/icons/UI Image/default-avatar.png",
  });

  // 🧭 Fetch dashboard summary
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          "http://localhost:5000/api/instructor/dashboard",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setStats({
          total_exams_created: res.data.total_exams_created || 0,
          total_tests_submitted: res.data.total_tests_submitted || 0,
          total_students_participated:
            res.data.total_students_participated || 0,
        });
      } catch (err) {
        console.error("❌ Lỗi lấy dữ liệu thống kê:", err);
      }
    };
    fetchStats();
  }, []);

  // 🧭 Fetch user info
  useEffect(() => {
    // Prefer avatar stored in localStorage (updated by Profile page upload)
    const localAvatar = localStorage.getItem("avatar");
    const localFullname = localStorage.getItem("fullname");
    if (localAvatar || localFullname) {
      setUserInfo((prev) => ({
        ...prev,
        fullname: localFullname || prev.fullname,
        avatar: localAvatar || prev.avatar,
      }));
    }

    // Try to load the canonical profile endpoint which returns the avatar/fullname
    const fetchUser = async () => {
      try {
        const res = await axiosClient.get('/profile');
        const user = res.data && res.data.data;
        if (user) {
          const avatarUrl = user.avatar || localAvatar || "/icons/UI Image/default-avatar.png";
          const fullname = user.full_name || localFullname || "Giảng viên";
          try {
            if (avatarUrl) localStorage.setItem('avatar', avatarUrl);
            if (fullname) localStorage.setItem('fullname', fullname);
          } catch (e) {}
          setUserInfo({ fullname, avatar: avatarUrl });
          return;
        }
      } catch (err) {
        // If profile endpoint fails, silently fallback to localStorage — keep console for debug
        console.warn('Failed to load /api/profile for header avatar:', err?.response || err?.message || err);
      }
    };
    fetchUser();

    // Listen for storage changes (avatar updated in Profile page)
    const onStorage = (e) => {
      if (e.key === 'avatar' || e.key === 'fullname') {
        setUserInfo((prev) => ({
          ...prev,
          avatar: localStorage.getItem('avatar') || prev.avatar,
          fullname: localStorage.getItem('fullname') || prev.fullname,
        }));
      }
    };

    // Also listen for an in-tab custom event dispatched by the Profile page
    const onProfileUpdated = () => {
      setUserInfo((prev) => ({
        ...prev,
        avatar: localStorage.getItem('avatar') || prev.avatar,
        fullname: localStorage.getItem('fullname') || prev.fullname,
      }));
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('profileUpdated', onProfileUpdated);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('profileUpdated', onProfileUpdated);
    };
  }, []);

  // 🧭 Fetch monthly chart data
  useEffect(() => {
    const fetchMonthly = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          "http://localhost:5000/api/instructor/dashboard/monthly",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const formatted = res.data.map((item) => ({
          name: `T${item.month}`,
          exams: item.exams_created,
          students: item.students_participated,
        }));
        setMonthlyData(formatted);
      } catch (err) {
        console.error("❌ Failed to fetch monthly stats:", err);
      }
    };
    fetchMonthly();
  }, []);

  // 🧭 Logout
  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <main className="flex-1 p-6">
        {/* Header */}
        <div className="flex justify-end items-center mb-6">
          <div
            onClick={() => navigate("/profile")}
            className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-100 rounded-lg transition"
          >
            <img
              src={userInfo.avatar}
              alt="User Avatar"
              title="Xem hồ sơ cá nhân"
              className="w-10 h-10 rounded-full border border-gray-200 object-cover"
            />
            <div className="flex items-center gap-2">
              <p className="text-gray-500 text-sm leading-tight">Xin chào,</p>
              <p className="font-semibold text-[#606060]">
                {userInfo.fullname}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition"
            title="Đăng xuất"
          >
            <FiLogOut className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Tổng số đề đã tạo */}
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-green-500 p-3 rounded-full flex items-center justify-center">
                <img
                  src="./icons/UI Image/student.png"
                  alt="icon"
                  className="w-6 h-6"
                />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-700">
                  {stats.total_exams_created}
                </p>
                <p className="text-gray-500">Tổng số đề đã tạo</p>
              </div>
            </div>
            <a
              href="#"
              className="text-gray-400 hover:text-gray-600 text-sm mt-4 self-end"
            >
              Xem →
            </a>
          </div>

          {/* Tổng số bài kiểm tra */}
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-red-500 p-3 rounded-full flex items-center justify-center">
                <img
                  src="./icons/UI Image/student1.png"
                  alt="icon"
                  className="w-6 h-6"
                />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-700">
                  {stats.total_tests_submitted}
                </p>
                <p className="text-gray-500">Tổng số bài kiểm tra</p>
              </div>
            </div>
            <a
              href="#"
              className="text-gray-400 hover:text-gray-600 text-sm mt-4 self-end"
            >
              Xem →
            </a>
          </div>

          {/* Tổng số thí sinh đã thi */}
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-purple-500 p-3 rounded-full flex items-center justify-center">
                <img
                  src="./icons/UI Image/student2.png"
                  alt="icon"
                  className="w-6 h-6"
                />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-700">
                  {stats.total_students_participated}
                </p>
                <p className="text-gray-500">Tổng số thí sinh đã thi</p>
              </div>
            </div>
            <a
              href="#"
              className="text-gray-400 hover:text-gray-600 text-sm mt-4 self-end"
            >
              Xem →
            </a>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-gray-700 font-semibold mb-2">Total Exams</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="name" />
                <Tooltip />
                <Bar dataKey="exams" fill="#7AB8FF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-gray-700 font-semibold mb-2">Total Students</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="name" />
                <Tooltip />
                <Bar dataKey="students" fill="#F88FA1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InstructorDashboard;
