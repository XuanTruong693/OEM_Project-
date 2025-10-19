import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  Outlet,
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
import VerifyRoom from "./authPages/VerifyRoom.jsx";

import InstructorDashboard from "./pages/instructorPage/InstructorDashboard.jsx";
import AssignExam from "./pages/instructorPage/AssignExam.jsx";
import ExamBank from "./pages/instructorPage/ExamBank.jsx";
import Resource from "./pages/instructorPage/Resource.jsx";
import Result from "./pages/instructorPage/Result.jsx";
import Setting from "./pages/instructorPage/Setting.jsx";

import InstructorSidebar from "./components/Instructor/InstructorSidebar.jsx";

function ProtectedRoute({ children, requiredRole }) {
  const location = useLocation();
  const role = localStorage.getItem("role");
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function InstructorLayout() {
  return (
    <div className="flex bg-gray-50 min-h-screen">
      <InstructorSidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
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

        <Route path="/role" element={<RolePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-room" element={<VerifyRoom />} />

        {/* <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        /> */}

        <Route
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/instructor-dashboard"
            element={<InstructorDashboard />}
          />
          <Route path="/resources" element={<Resource />} />
          <Route path="/exam-bank" element={<ExamBank />} />
          <Route path="/assign-exam" element={<AssignExam />} />
          <Route path="/result" element={<Result />} />
          <Route path="/setting" element={<Setting />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
