import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function RolePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.removeItem("selectedRole");
  }, []);

  const handleSelectRole = (role) => {
    setLoading(true);
    const selectedRole = role === "instructor" ? "instructor" : "student";
    localStorage.setItem("selectedRole", selectedRole);

    if (selectedRole === "instructor") {
      navigate("/login", { state: { fromRoleSelection: true } });
    } else {
      navigate("/verify-room", { state: { fromRoleSelection: true } });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-semibold mb-6 text-gray-700">Bạn là ai?</h1>
      <div className="flex gap-4">
        <button
          onClick={() => handleSelectRole("instructor")}
          disabled={loading}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all active:scale-95"
        >
          {loading ? "Đang xử lý..." : "Giảng viên"}
        </button>
        <button
          onClick={() => handleSelectRole("student")}
          disabled={loading}
          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all active:scale-95"
        >
          {loading ? "Đang xử lý..." : "Học sinh"}
        </button>
      </div>
    </div>
  );
}
