// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";

// Các trang có layout
import LandingPage from "./pages/LandingPage.jsx";
import AboutUs from "./pages/AboutUs.jsx";
import Contract from "./pages/Contract.jsx";
import Features from "./pages/Features.jsx";
import News from "./pages/News.jsx";

// Các trang auth (không layout)
import LoginPage from "./authPages/LoginPage.jsx";
import RegisterPage from "./authPages/RegisterPage.jsx";
import RolePage from "./authPages/RolePage.jsx";

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Các trang có Layout */}
        <Route
          path="/"
          element={
            <Layout>
              <LandingPage />
            </Layout>
          }
        />
        <Route
          path="/ve-chung-toi"
          element={
            <Layout>
              <AboutUs />
            </Layout>
          }
        />
        <Route
          path="/tinh-nang"
          element={
            <Layout>
              <Features />
            </Layout>
          }
        />
        <Route
          path="/tin-tuc"
          element={
            <Layout>
              <News />
            </Layout>
          }
        />
        <Route
          path="/lien-he"
          element={
            <Layout>
              <Contract />
            </Layout>
          }
        />

        <Route path="/phan-quyen" element={<RolePage />} />
        <Route path="/dang-nhap" element={<LoginPage />} />
        <Route path="/dang-ky-ngay" element={<RegisterPage />} />
      </Routes>
    </Router>
  );
};

export default App;
