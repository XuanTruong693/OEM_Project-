import React from "react";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const navigate = useNavigate();

  const menuItems = [
    { text: "Về chúng tôi", path: "/ve-chung-toi" },
    { text: "Tính năng", path: "/tinh-nang" },
    { text: "Tin tức", path: "/tin-tuc" },
    { text: "Liên hệ", path: "/lien-he" },
  ];

  return (
    <header className="flex flex-col md:flex-row items-center justify-between mx-auto w-full max-w-7xl px-3 py-2 md:px-4 md:py-3 gap-2 md:gap-3">
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => navigate("/")}
      >
        <img
          src="/Logo.png"
          alt="OEM Logo"
          className="h-16 sm:h-20 md:h-24 w-auto"
        />
      </div>

      {/* Menu */}
      <nav className="flex gap-5 sm:gap-8 md:gap-12 flex-1 justify-center items-center text-[#023e8a] font-extrabold">
        {menuItems.map(({ text, path }, idx) => (
          <span
            key={idx}
            onClick={() => navigate(path)}
            className="text-sm sm:text-base md:text-lg xl:text-xl pb-1 border-b-0 hover:border-b-4 hover:border-blue-500 hover:text-[#007bf6] transition-all cursor-pointer"
          >
            {text}
          </span>
        ))}
      </nav>

      {/* Nút hành động */}
      <div className="flex gap-2 sm:gap-3 items-center mt-2 md:mt-0 text-sm sm:text-base md:text-lg font-bold">
        <button
          onClick={() => navigate("/dang-ky-ngay")}
          className="!bg-[#0077b6] !text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all duration-300 ease-in-out active:scale-95"
        >
          Đăng Ký Ngay
        </button>
        <button
          onClick={() => navigate("/dang-nhap")}
          className="border-2 !border-[#0077b6] !bg-transparent !text-[#0077b6] px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all duration-300 ease-in-out hover:bg-[#0077b6]/10 active:scale-95"
        >
          Đăng Nhập
        </button>
      </div>
    </header>
  );
};

export default Navbar;
