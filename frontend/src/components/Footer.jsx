import React from "react";

export default function Footer() {
  return (
    <footer className="w-full py-6 px-4 flex items-center justify-center text-center text-sm text-gray-500 ">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a href="#" className="!text-black hover:underline">
          Chính sách dịch vụ
        </a>
        <span>|</span>
        <a href="#" className="!text-black hover:underline">
          Điều khoản thông tin
        </a>
      </div>
    </footer>
  );
}
