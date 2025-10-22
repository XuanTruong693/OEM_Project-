import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FiHome,
  FiFolder,
  FiFileText,
  FiEdit3,
  FiClipboard,
  FiSettings,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";

const InstructorSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState(null);

  const handleToggle = (label) => {
    setOpenMenu(openMenu === label ? null : label);
  };

  const menu = [
    {
      icon: FiHome,
      label: "Dashboard",
      path: "/instructor-dashboard",
    },
    {
      icon: FiFolder,
      label: "Resources",
      children: [
        {
          icon: FiFileText,
          label: "Exam Bank",
          path: "/exam-bank",
        },
        {
          icon: FiEdit3,
          label: "Assign Exam",
          path: "/assign-exam",
        },
      ],
    },
    {
      icon: FiClipboard,
      label: "Result",
      path: "/result",
    },
  ];

  const setting = {
    icon: FiSettings,
    label: "Setting",
    path: "/setting",
  };

  return (
    <aside className="min-h-screen h-full bg-gradient-to-b from-[#E8F5FF] to-[#CAEAFF] rounded-3xl p-5 shadow-md flex flex-col justify-between">
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
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.children &&
                item.children.some(
                  (child) => child.path === location.pathname
                ));
            const isOpen = openMenu === item.label;

            return (
              <div key={idx}>
                <button
                  onClick={() =>
                    item.children
                      ? handleToggle(item.label)
                      : navigate(item.path)
                  }
                  className={`group flex items-center justify-between text-lg font-medium px-4 py-3 rounded-xl transition-all duration-200 w-full ${
                    isActive
                      ? "bg-[#0080FF]/10 text-[#0080FF] shadow-sm border-l-4"
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
                    <span className="transition-colors duration-200">
                      {item.label}
                    </span>
                  </div>
                  {item.children &&
                    (isOpen ? (
                      <FiChevronUp
                        className={`w-5 h-5  transition-colors duration-200  ${
                          isActive
                            ? "text-[#0080FF] "
                            : "text-gray-500 group-hover:text-[#0080FF]"
                        }`}
                      />
                    ) : (
                      <FiChevronDown
                        className={`w-5 h-5 transition-colors duration-200  ${
                          isActive
                            ? "text-[#0080FF]"
                            : "text-gray-500 group-hover:text-[#0080FF]"
                        }`}
                      />
                    ))}
                </button>

                {item.children && isOpen && (
                  <div className="ml-8 mt-2 flex flex-col gap-1">
                    {item.children.map((subItem, subIdx) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = location.pathname === subItem.path;
                      return (
                        <button
                          key={subIdx}
                          onClick={() => navigate(subItem.path)}
                          className={`group flex items-center gap-3 text-base font-medium px-3 py-2 rounded-lg transition-all duration-200 w-full ${
                            isSubActive
                              ? "bg-[#0080FF]/10 text-[#0080FF] border-l-4"
                              : "text-gray-600 hover:bg-[#A0D4FF]/60 hover:text-[#0080FF]"
                          }`}
                        >
                          <SubIcon
                            className={`w-5 h-5 transition-colors duration-200 ${
                              isSubActive
                                ? "text-[#0080FF]"
                                : "text-gray-600 group-hover:text-[#0080FF]"
                            }`}
                          />
                          <span className="transition-colors duration-200">
                            {subItem.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-blue-100 pt-3 mt-3">
        <button
          onClick={() => navigate(setting.path)}
          className={`group flex items-center gap-3 text-lg font-medium px-4 py-3 rounded-xl transition-all duration-200 w-full ${
            location.pathname === setting.path
              ? "bg-[#0080FF]/10 text-[#0080FF] shadow-sm border-l-4"
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
          <span className="transition-colors duration-200">
            {setting.label}
          </span>
        </button>
      </div>
    </aside>
  );
};

export default InstructorSidebar;
