import React, { useState, useRef, useEffect } from "react";
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

  // refs
  const dropdownRef = useRef(null);
  const resourcesRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // -----------------------------------------
  // Sidebar Content Component
  // -----------------------------------------
  const SidebarContent = () => (
    <div className="flex flex-col w-full justify-between h-full p-5 text-slate-800">
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

            const handleMouseEnter = () => {
              // only for desktop hover behavior
              if (window.innerWidth >= 768 && item.hasDropdown) {
                if (closeTimeoutRef.current) {
                  clearTimeout(closeTimeoutRef.current);
                }
                setOpenDropdown(item.label);
              }
            };

            const handleMouseLeave = (e) => {
              // when leaving the button, give a short grace period so user can move into dropdown
              if (window.innerWidth >= 768 && item.hasDropdown) {
                closeTimeoutRef.current = setTimeout(() => {
                  setOpenDropdown((prev) =>
                    prev === item.label ? null : prev
                  );
                }, 150);
              }
            };

            return (
              <div key={idx} className="relative">
                {/* Nav item */}
                <button
                  ref={item.hasDropdown ? resourcesRef : null}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => {
                    if (item.hasDropdown) {
                      // toggle on click (works both desktop & mobile)
                      setOpenDropdown(
                        openDropdown === item.label ? null : item.label
                      );
                    } else {
                      navigate(item.path);
                      setMobileOpen(false);
                    }
                  }}
                  className={`group flex items-center justify-between text-lg font-medium px-4 py-3 rounded-xl transition-all duration-200 w-full ${isActive
                      ? "bg-[#0080FF]/10 border-l-4 border-[#0080FF] text-[#0080FF] shadow-sm"
                      : "text-gray-700 hover:bg-[#A0D4FF]/60 hover:text-[#0080FF]"
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <Icon
                      className={`w-6 h-6 transition-colors duration-200 ${isActive
                          ? "text-[#0080FF]"
                          : "text-gray-600 group-hover:text-[#0080FF]"
                        }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.hasDropdown && (
                    <FiChevronDown
                      className={`w-5 h-5 text-gray-600 transition-transform ${openDropdown === item.label ? "rotate-180" : ""
                        }`}
                    />
                  )}
                </button>

                {/* Dropdown */}
                {item.hasDropdown && openDropdown === item.label && (
                  <div
                    ref={dropdownRef}
                    className="ml-6 bg-white shadow-lg rounded-xl border border-gray-200 py-2 w-44 md:absolute md:left-full md:top-0 z-50"
                    onMouseEnter={() => {
                      // user moved into dropdown — cancel any scheduled close
                      if (closeTimeoutRef.current) {
                        clearTimeout(closeTimeoutRef.current);
                      }
                    }}
                    onMouseLeave={() => {
                      // close immediately when leaving dropdown
                      if (window.innerWidth >= 768) {
                        setOpenDropdown(null);
                      }
                    }}
                  >
                    <button
                      onClick={() => {
                        navigate("/exam-bank");
                        setOpenDropdown(null);
                        setMobileOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[#E8F5FF] text-gray-700 hover:text-[#0080FF] w-full text-left"
                    >
                      <FiFileText className="w-5 h-5" />
                      {t("exam_bank", "Ngân hàng đề", "Exam Bank")}
                    </button>

                    <button
                      onClick={() => {
                        navigate("/open-exam");
                        setOpenDropdown(null);
                        setMobileOpen(false);
                      }}
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
          className={`group flex items-center gap-3 text-lg font-medium px-4 py-3 rounded-xl transition-all duration-200 w-full ${location.pathname === setting.path
              ? "bg-[#0080FF]/10 border-l-4 border-[#0080FF] text-[#0080FF] shadow-sm"
              : "text-gray-700 hover:bg-[#A0D4FF]/60 hover:text-[#0080FF]"
            }`}
        >
          {/* render icon safely */}
          {(() => {
            const SettingIcon = setting.icon;
            return (
              <SettingIcon
                className={`w-6 h-6 transition-colors duration-200 ${location.pathname === setting.path
                    ? "text-[#0080FF]"
                    : "text-gray-600 group-hover:text-[#0080FF]"
                  }`}
              />
            );
          })()}

          <span>{setting.label}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 h-screen bg-gradient-to-b from-[#E8F5FF] to-[#CAEAFF] shadow-md rounded-tr-3xl rounded-br-3xl">
        <SidebarContent />
      </aside>

      {/* Mobile toggle button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-white p-2 rounded-lg shadow-lg"
        onClick={() => setMobileOpen(true)}
      >
        <FiMenu className="w-6 h-6 text-gray-700" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        ></div>
      )}

      {/* Mobile drawer */}
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
