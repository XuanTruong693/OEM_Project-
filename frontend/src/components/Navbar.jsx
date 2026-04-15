import React from "react";
import { useNavigate } from "react-router-dom";

import TranslationBar from "./common/TranslationBar.jsx";

const Navbar = () => {
  const navigate = useNavigate();

  const menuItems = [
    { text: "Về chúng tôi", id: "about" },
    { text: "Tính năng", id: "features" },
    { text: "Tin tức", id: "news" },
    { text: "Liên hệ", id: "contact" },
  ];

  const handleScroll = (id) => {
    if (window.location.pathname !== "/") {
      navigate(`/#${id}`);
    } else {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-transparent backdrop-blur-md">
      <div className="flex flex-col md:flex-row items-center justify-between mx-auto w-full max-w-7xl px-3 py-2 md:px-4 md:py-3 gap-2 md:gap-3">
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => handleScroll("home")}
      >
        <img
          src="/Logo.png"
          alt="OEM Logo"
          className="h-16 sm:h-20 md:h-24 w-auto"
        />
      </div>
      <nav className="flex gap-5 sm:gap-8 md:gap-12 flex-1 justify-center items-center text-[#023e8a] font-extrabold">
        {menuItems.map(({ text, id }, idx) => (
          <span
            key={idx}
            onClick={() => handleScroll(id)}
            className="text-sm sm:text-base md:text-lg xl:text-xl pb-1 border-b-0 hover:border-b-4 hover:border-blue-500 hover:text-[#007bf6] transition-all cursor-pointer whitespace-nowrap"
          >
            {text}
          </span>
        ))}
      </nav>
      <div className="flex gap-2 sm:gap-3 items-center mt-2 md:mt-0 text-sm sm:text-base md:text-lg font-bold">
        <button
          onClick={() => navigate("/role", { state: { mode: "register" } })}
          className="bg-[#0077b6] cursor-pointer text-white min-w-[140px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all duration-300 ease-in-out active:scale-95 whitespace-nowrap flex items-center justify-center"
        >
          <span>Đăng Ký Ngay</span>
        </button>
        <button
          onClick={() => navigate("/role", { state: { mode: "login" } })}
          className="border cursor-pointer border-[#0077b6] !bg-transparent text-[#0077b6] min-w-[140px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all duration-300 ease-in-out hover:bg-[#0077b6]/10 active:scale-95 whitespace-nowrap flex items-center justify-center"
        >
          <span>Đăng Nhập</span>
        </button>

        {/* Compact Dropdown Translation Selector */}
        <div className="ml-1">
          <TranslationBar inline={true} />
        </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
