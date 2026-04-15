import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import AboutUs from "./AboutUs.jsx";
import Features from "./Features.jsx";
import News from "./News.jsx";
import Contact from "./Contract.jsx";

export default function LandingPage() {
  const navigate = useNavigate();
  const [apiInfo, setApiInfo] = useState(null);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (token && role) {
      const dashboardPath = role === "student"
        ? "/student-dashboard"
        : role === "admin"
          ? "/admin-dashboard"
          : "/instructor-dashboard";
      navigate(dashboardPath);
    }
  }, [navigate]);

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
    <div className="w-full flex flex-col gap-10">
      {/* Hero Section */}
      <section id="home" className="w-full min-h-[calc(100vh-80px)] p-6 pt-20 md:pt-32 flex flex-col justify-start">
        <div className="max-w-[1400px] mx-auto px-4 md:px-10 rounded-3xl w-full">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <motion.div
              className="relative pt-16 lg:pt-0"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                className="inline-block border-[3px] border-[#005fbd] text-[#0097e9] px-6 py-3 rounded-lg -rotate-6 font-black text-lg mb-6 shadow-md"
                whileHover={{ scale: 1.1, rotate: 0 }}
              >
                OEM Mini
              </motion.div>
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
            </motion.div>
            <div className="flex justify-center items-center">
              <div className="w-full max-w-[500px] relative">
                <motion.img
                  src="/icons/UI Image/process.png"
                  alt="Process Illustration"
                  className="w-full h-auto"
                  style={{ mixBlendMode: 'multiply' }}
                  initial={{ y: 0, opacity: 0, scale: 0.8 }}
                  whileInView={{
                    y: [0, -20, 0],
                    opacity: 1,
                    scale: 1
                  }}
                  viewport={{ once: true }}
                  transition={{
                    y: {
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut"
                    },
                    opacity: { duration: 0.8 },
                    scale: { duration: 0.8 }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Other Sections with Reveal Animation */}
      <SectionWrapper id="about">
        <AboutUs />
      </SectionWrapper>

      <SectionWrapper id="features">
        <Features />
      </SectionWrapper>

      <SectionWrapper id="news">
        <News />
      </SectionWrapper>

      <SectionWrapper id="contact">
        <Contact />
      </SectionWrapper>
    </div>
  );
}

// Helper component for scrolling reveal
function SectionWrapper({ children, id }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 150 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{
        duration: 0.8,
        ease: "easeOut"
      }}
      className="w-full"
    >
      {children}
    </motion.section>
  );
}
