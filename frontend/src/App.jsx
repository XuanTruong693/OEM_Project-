// src/App.jsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Layout from "./components/Layout.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import AboutUs from "./pages/AboutUs.jsx";
import Contract from "./pages/Contract.jsx";
import Features from "./pages/Features.jsx";
import News from "./pages/News.jsx";
import LoginPage from "./authPages/LoginPage.jsx";
import RegisterPage from "./authPages/RegisterPage.jsx";
import RolePage from "./authPages/RolePage.jsx";

// chặn truy cập trực tiếp vào trang đăng nhập và đăng ký thủ công
function ProtectedRoute({ children }) {
  const location = useLocation();
  const role = location.state?.role || sessionStorage.getItem("role");
  if (location.state?.role) {
    sessionStorage.setItem("role", location.state.role);
  }
  const isManualAccess = !location.state && !sessionStorage.getItem("role");
  if (isManualAccess) {
    return <Navigate to="/phan-quyen" replace />;
  }

  return children;
}

const App = () => {
  return (
    <Router>
      <Routes>
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
        <Route
          path="/dang-nhap"
          element={
            <ProtectedRoute>
              <LoginPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dang-ky-ngay"
          element={
            <ProtectedRoute>
              <RegisterPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
