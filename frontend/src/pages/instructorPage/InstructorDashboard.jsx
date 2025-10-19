import React, { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { FiLogOut } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import InstructorSummary from "../../components/Instructor/InstructorSummary";

const InstructorDashboard = () => {
  const navigate = useNavigate();

  // 🧠 State lưu thông tin người dùng
  const [userInfo, setUserInfo] = useState({
    fullname: "",
    avatar: "",
  });

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const fullname =
        user?.full_name ||
        user?.fullname ||
        localStorage.getItem("fullname") ||
        "Giảng viên";
      const avatar =
        user?.avatar ||
        localStorage.getItem("avatar") ||
        "/icons/UI Image/default-avatar.png";
      setUserInfo({ fullname, avatar });
    } catch {
      const fullname =
        localStorage.getItem("fullname") ||
        localStorage.getItem("full_name") ||
        "Giảng viên";
      const avatar =
        localStorage.getItem("avatar") || "/icons/UI Image/default-avatar.png";
      setUserInfo({ fullname, avatar });
    }
  }, []);
  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  // 📊 Dữ liệu biểu đồ
  const examsData = [
    { name: "T1", count: 120 },
    { name: "T2", count: 140 },
    { name: "T3", count: 180 },
    { name: "T4", count: 200 },
    { name: "T5", count: 200 },
    { name: "T6", count: 200 },
    { name: "T7", count: 200 },
    { name: "T8", count: 200 },
  ];

  const studentsData = [
    { name: "T1", count: 80 },
    { name: "T2", count: 100 },
    { name: "T3", count: 150 },
    { name: "T4", count: 170 },
    { name: "T5", count: 170 },
    { name: "T6", count: 170 },
    { name: "T7", count: 170 },
    { name: "T8", count: 170 },
  ];

  const totalExams = useMemo(
    () => examsData.reduce((sum, item) => sum + item.count, 0),
    [examsData]
  );

  const totalStudents = useMemo(
    () => studentsData.reduce((sum, item) => sum + item.count, 0),
    [studentsData]
  );

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <main className="flex-1 p-6">
        <div className="flex justify-end items-center mb-6">
          <div className="flex items-center gap-3 px-4 py-2  ">
            <img
              src={userInfo.avatar}
              alt="User Avatar"
              className="w-10 h-10 rounded-full border border-gray-200 object-cover"
            />
            <div className="flex items-center gap-2">
              <p className="text-gray-500 text-sm">Xin chào,</p>
              <p className="font-semibold text-gray-700">{userInfo.fullname}</p>
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

        <InstructorSummary />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Exams */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between flex-1 pb-12">
              <div>
                <h2 className="text-gray-700 font-semibold mb-1">Exams</h2>
                <h3 className="text-xl font-bold">{totalExams}</h3>
              </div>
              <img
                src="/icons/UI Image/rise.png"
                alt="Exams Icon"
                className="w-10 h-10 object-contain opacity-80"
              />
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={examsData}>
                <XAxis dataKey="name" />
                <Tooltip cursor={false} />
                <Bar dataKey="count" fill="#7AB8FF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between flex-1 pb-12">
              <div>
                <h2 className="text-gray-700 font-semibold mb-1">Students</h2>
                <h3 className="text-xl font-bold">{totalStudents}</h3>
              </div>
              <img
                src="/icons/UI Image/down.png"
                alt="Students Icon"
                className="w-10 h-10 object-contain opacity-80"
              />
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={studentsData}>
                <XAxis dataKey="name" />
                <Tooltip cursor={false} />
                <Bar dataKey="count" fill="#F88FA1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InstructorDashboard;
