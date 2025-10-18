import React from "react";

export default function Footer() {
  return (
    <footer className="w-full py-6 px-4  text-gray-600 text-sm text-center ">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="#"
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          Chính sách dịch vụ
        </a>
        <span>|</span>
        <a
          href="#"
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          Điều khoản thông tin
        </a>
      </div>
    </footer>
  );
}
