import React, { useEffect, useState } from "react";
import axios from "axios";

export default function LandingPage() {
  const [apiInfo, setApiInfo] = useState(null);

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/info")
      .then((response) => {
        console.log("API Response:", response.data);
        setApiInfo(response.data);
      })
      .catch((error) => {
        console.error("Error fetching API:", error);
      });
  }, []);

  return (
    <div className="w-full h-auto flex flex-col items-center justify-start bg-white">
      <div className="w-full  bg-gradient-to-r from-[#e7f7ff] to-[#fff0fb] shadow-lg py-10 md:py-16">
        <div className="max-w-[1400px] mx-auto px-4 md:px-10 rounded-3xl">
          <header className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-3">
              <img src="/Logo.png" alt="OEM Logo" className="h-24 w-auto" />
            </div>

            <nav className="hidden md:flex gap-8 flex-1 justify-center items-center">
              {["Về chúng tôi", "Tính năng", "Tin tức", "Liên hệ"].map(
                (text, idx) => (
                  <a
                    key={idx}
                    href={`#${text.toLowerCase().replace(/\s/g, "")}`}
                    className="text-[#023e8a] font-extrabold text-lg md:text-xl pb-1 border-b-0 hover:border-b-4 hover:border-blue-500 hover:text-[#007bf6] transition-all"
                  >
                    {text}
                  </a>
                )
              )}
            </nav>
            {/* bg-[#0077b6] */}

            <div className="flex gap-3 items-center mt-3 md:mt-0">
              <button className="!bg-[#0077b6] !text-white px-4 py-2 rounded-lg font-bold transition-all duration-300 ease-in-out active:scale-95">
                Đăng Ký Ngay
              </button>

              <button className="border-2 !border-[#0077b6] !bg-transparent !text-[#0077b6] px-4 py-2 rounded-lg font-bold transition-all duration-300 ease-in-out hover:bg-[#0077b6]/10 active:scale-95">
                Đăng Nhập
              </button>
            </div>
          </header>

          <section className="mt-10 min-h-screen h-auto">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="relative pt-16 lg:pt-0">
                <div className="inline-block border-[3px] border-[#005fbd] text-[#0097e9] px-6 py-3 rounded-lg -rotate-6 font-black text-lg mb-6 shadow-md">
                  OEM Mini
                </div>

                <h1 className="text-3xl md:text-5xl font-extrabold text-[#023e8a] leading-tight mb-4">
                  Hệ thống đắc lực hỗ trợ
                  <br />
                  <span className="block text-2xl md:text-4xl font-bold text-[#00c3ffcc] mt-4">
                    thi trực tuyến hiệu quả
                  </span>
                </h1>

                {apiInfo && (
                  <p className="mt-6 p-4 text-green-700 text-sm md:text-base bg-green-50 rounded">
                    {apiInfo.name} - v{apiInfo.version}
                    <br />
                    {apiInfo.description}
                  </p>
                )}
              </div>

              <div className="flex justify-center items-center">
                <div className="w-full max-w-[500px]  relative">
                  <img
                    src="/process.png"
                    alt="Process Illustration"
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
