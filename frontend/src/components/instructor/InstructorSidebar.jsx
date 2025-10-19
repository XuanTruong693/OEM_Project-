import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FiHome,
  FiFolder,
  FiFileText,
  FiEdit3,
  FiClipboard,
  FiSettings,
} from "react-icons/fi";

const InstructorSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menu = [
    {
      icon: <FiHome className="w-6 h-6" />,
      label: "Dashboard",
      path: "/instructor-dashboard",
    },
    {
      icon: <FiFolder className="w-6 h-6" />,
      label: "Resources",
      path: "/resources",
    },
    {
      icon: <FiFileText className="w-6 h-6" />,
      label: "Exam Bank",
      path: "/exam-bank",
    },
    {
      icon: <FiEdit3 className="w-6 h-6" />,
      label: "Assign Exam",
      path: "/assign-exam",
    },
    {
      icon: <FiClipboard className="w-6 h-6" />,
      label: "Result",
      path: "/result",
    },
  ];

  const setting = {
    icon: <FiSettings className="w-6 h-6" />,
    label: "Setting",
    path: "/setting",
  };

  return (
    <aside className="w-64 h-screen bg-gradient-to-b from-[#E8F5FF] to-[#CAEAFF] rounded-3xl p-5 shadow-md flex flex-col justify-between">
      <div>
        <div
          className="flex items-center justify-center mb-8 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <img
            src="/Logo.png"
            alt="OEM Logo"
            className="h-20 w-auto drop-shadow-md"
          />
        </div>

        <nav className="flex flex-col gap-2">
          {menu.map((item, idx) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={idx}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-4 text-lg font-medium px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-[#0080FF]/10 border-[#0080FF] text-[#0080FF] shadow-sm"
                    : "text-gray-700 hover:bg-[#A0D4FF]/60 hover:text-[#0080FF]"
                }`}
              >
                <span
                  className={`transition-transform duration-200 ${
                    isActive ? "text-[#0080FF]" : "text-gray-600"
                  }`}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-blue-100 pt-3 mt-3">
        <button
          onClick={() => navigate(setting.path)}
          className={`flex items-center gap-3 text-lg font-medium px-4 py-3 rounded-xl transition-all duration-200 w-full ${
            location.pathname === setting.path
              ? "bg-[#0080FF]/10 border-l-4 border-[#0080FF] text-[#0080FF] shadow-sm"
              : "text-gray-700 hover:bg-[#A0D4FF]/60 hover:text-[#0080FF]"
          }`}
        >
          <span
            className={`transition-transform duration-200 ${
              location.pathname === setting.path
                ? "text-[#0080FF]"
                : "text-gray-600"
            }`}
          >
            {setting.icon}
          </span>
          <span>{setting.label}</span>
        </button>
      </div>
    </aside>
  );
};

export default InstructorSidebar;
