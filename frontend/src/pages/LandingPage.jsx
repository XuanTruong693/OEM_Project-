import React, { useEffect, useState } from "react";
import axios from "axios";

export default function LandingPage() {
  const [apiInfo, setApiInfo] = useState(null);
  const [apiError, setApiError] = useState(null);

  // useEffect(() => {
  //   axios
  //     // .get("http://localhost:5000/api/info")
  //     // .then((response) => {
  //     //   console.log("API Response:", response.data);
  //     //   setApiInfo(response.data);
  //     //   setApiError(null);
  //     // })
  //     // .catch((error) => {
  //     //   console.error("Error fetching API:", error);
  //     //   setApiError("Không thể kết nối đến server");
  //     //   setApiInfo(null);
  //     // });
  // }, []);

  return (
    <section className="w-full min-h-[calc(100vh-60px)] p-6 ">
      <div className="max-w-[1400px] mx-auto px-4 md:px-10 rounded-3xl">
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
              {apiError && (
                <p className="mt-6 p-4 text-red-700 text-sm md:text-base bg-red-50 rounded">
                  ⚠️ {apiError}
                </p>
              )}
            </div>
            <div className="flex justify-center items-center">
              <div className="w-full max-w-[500px] relative">
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
    </section>
  );
}
