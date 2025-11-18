import React, { useState, useRef } from "react";
import {
  FiHome,
  FiFolder,
  FiFileText,
  FiEdit3,
  FiClipboard,
  FiSettings,
  FiChevronDown,
  FiMenu,
  FiX,
} from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { useUi } from "../../context/UiContext.jsx";

const InstructorSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [openDropdown, setOpenDropdown] = useState(null);

  const [mobileOpen, setMobileOpen] = useState(false);

  const { t } = useUi();

  const menu = [
    {
      icon: FiHome,
      label: t("dashboard", "Bảng điều khiển", "Dashboard"),
      path: "/instructor-dashboard",
    },
    {
      icon: FiFolder,
      label: t("resources", "Tài nguyên", "Resources"),
      path: "/resources",
      hasDropdown: true,
    },
    {
      icon: FiFileText,
      label: t("exam_bank", "Ngân hàng đề", "Exam Bank"),
      path: "/exam-bank",
    },
    {
      icon: FiEdit3,
      label: t("assign_exam", "Assign Exam", "Assign Exam"),
      path: "/assign-exam",
    },
    {
      icon: FiClipboard,
      label: t("result", "Kết quả", "Result"),
      path: "/result",
    },
  ];

  const setting = {
    icon: FiSettings,
    label: t("setting", "Cài đặt", "Setting"),
    path: "/setting",
  };

  const dropdownRef = useRef(null);
  const resourcesRef = useRef(null);

  const handleMouseEnter = (item) => {
    if (item.hasDropdown && window.innerWidth >= 768) {
      setOpenDropdown(item.label);
    }
  };

  const handleMouseLeave = (e, item) => {
    if (!item.hasDropdown || window.innerWidth < 768) return;

    const related = e.relatedTarget;

    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(related) &&
      resourcesRef.current &&
      !resourcesRef.current.contains(related)
    ) {
      setOpenDropdown(null);
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col w-full justify-between h-fullz p-5 text-slate-800">
      <div>
        <div
          className="flex items-center justify-center mb-8 cursor-pointer"
          onClick={() => navigate("/instructor-dashboard")}
        >
          <img
            src="/Logo.png"
            alt="OEM Logo"
            className="h-20 w-auto drop-shadow-md"
          />
        </div>

        <nav className="flex flex-col gap-2 relative">
          {menu.map((item, idx) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <div
                key={idx}
                className="relative"
                onMouseEnter={() =>
                  item.hasDropdown && setOpenDropdown(item.label)
                }
                onMouseLeave={() => item.hasDropdown && setOpenDropdown(null)}
              >
                {/* Nav item */}
                <button
                  onClick={() => {
                    if (item.hasDropdown) {
                      setOpenDropdown(
                        openDropdown === item.label ? null : item.label
                      );
                    } else {
                      navigate(item.path);
                      setMobileOpen(false);
                    }
                  }}
                  className={`group flex items-center justify-between text-lg font-medium px-4 py-3 rounded-xl transition-all duration-200 w-full ${
                    isActive
                      ? "bg-[#0080FF]/10 border-l-4 border-[#0080FF] text-[#0080FF] shadow-sm"
                      : "text-gray-700 hover:bg-[#A0D4FF]/60 hover:text-[#0080FF]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Icon
                      className={`w-6 h-6 transition-colors duration-200 ${
                        isActive
                          ? "text-[#0080FF]"
                          : "text-gray-600 group-hover:text-[#0080FF]"
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.hasDropdown && (
                    <FiChevronDown
                      className={`w-5 h-5 text-gray-600 transition-transform ${
                        openDropdown === item.label ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>

                {/* Dropdown */}
                {item.hasDropdown && openDropdown === item.label && (
                  <div className="ml-6 bg-white shadow-lg rounded-xl border border-gray-200 py-2 w-44 md:absolute md:left-full md:top-0">
                    <button
                      onClick={() => navigate("/exam-bank")}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[#E8F5FF] text-gray-700 hover:text-[#0080FF] w-full text-left"
                    >
                      <FiFileText className="w-5 h-5" />
                      {t("exam_bank", "Ngân hàng đề", "Exam Bank")}
                    </button>
                    <button
                      onClick={() => navigate("/open-exam")}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[#E8F5FF] text-gray-700 hover:text-[#0080FF] w-full text-left"
                    >
                      <FiEdit3 className="w-5 h-5" />
                      {t("open_room", "Mở phòng thi", "Open Room")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-blue-100 pt-3 mt-3">
        <button
          onClick={() => {
            navigate(setting.path);
            setMobileOpen(false);
          }}
          className={`group flex items-center gap-3 text-lg font-medium px-4 py-3 rounded-xl transition-all duration-200 w-full ${
            location.pathname === setting.path
              ? "bg-[#0080FF]/10 border-l-4 border-[#0080FF] text-[#0080FF] shadow-sm"
              : "text-gray-700 hover:bg-[#A0D4FF]/60 hover:text-[#0080FF]"
          }`}
        >
          <setting.icon
            className={`w-6 h-6 transition-colors duration-200 ${
              location.pathname === setting.path
                ? "text-[#0080FF]"
                : "text-gray-600 group-hover:text-[#0080FF]"
            }`}
          />
          <span>{setting.label}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex w-64 h-screen bg-gradient-to-b from-[#E8F5FF] to-[#CAEAFF] shadow-md rounded-tr-3xl rounded-br-3xl">
        <SidebarContent />
      </aside>
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-white p-2 rounded-lg shadow-lg"
        onClick={() => setMobileOpen(true)}
      >
        <FiMenu className="w-6 h-6 text-gray-700" />
      </button>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        ></div>
      )}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-[#E8F5FF] to-[#CAEAFF] shadow-xl z-50 transform transition-transform duration-300 md:hidden
                ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex justify-end p-4">
          <button onClick={() => setMobileOpen(false)}>
            <FiX className="w-6 h-6 text-gray-700" />
          </button>
        </div>
        <SidebarContent />
      </div>
    </>
  );
};

export default InstructorSidebar;
