import React, { useEffect, useState } from "react";
import axios from "axios";
import "./LandingPage.css";

export default function LandingPage() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    axios
      .get("/api/info")
      .then((res) => setInfo(res.data))
      .catch((err) => console.error("API error:", err));
  }, []);

  return (
    <div className="page-wrapper">
      <div className="page-card">
        {/* NAVBAR */}
        <header className="navbar">
          <div className="nav-left">
            <div className="logo">
              <img src="/Logo.png" alt="OEM Logo" />
              <div className="logo-text">
              </div>
            </div>
          </div>

          <nav className="nav-center">
            <a href="#about">Về chúng tôi</a>
            <a href="#features">Tính năng</a>
            <a href="#news">Tin tức</a>
            <a href="#contact">Liên hệ</a>
          </nav>

          <div className="auth-buttons">
            <button className="btn-primary">Đăng Ký Ngay</button>
            <button className="btn-outline">Đăng Nhập</button>
          </div>
        </header>

        {/* HERO */}
        <section className="hero">
          <div className="hero-grid">
            <div className="hero-left">
              <div className="badge">OEM Mini</div>

              <div className="heading-wrap">
                <h1>
                  Hệ thống đắc lực hỗ trợ
                  <br />
                  <span>thi trực tuyến hiệu quả</span>
                </h1>
              </div>

              {info && (
                <p className="api-info">
                  {info.name} - {info.version}
                </p>
              )}
            </div>

            <div className="hero-right">
              <div className="image-wrap">
                <img src="/process.png" alt="Process Illustration" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
