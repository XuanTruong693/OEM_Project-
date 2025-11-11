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
import ForgotPassword from "./authPages/ForgotPassword.jsx";
import VerifyEmail from "./authPages/VerifyEmail.jsx";
import ResetPassword from "./authPages/ResetPassword.jsx";

import InstructorDashboard from "./pages/instructorPage/InstructorDashboard.jsx";
import AssignExam from "./pages/instructorPage/AssignExam.jsx";
import ExamBank from "./pages/instructorPage/ExamBank.jsx";
import OpenExam from "./pages/instructorPage/OpenExam.jsx";
import ExamSettings from "./pages/instructorPage/ExamSettings.jsx";
import ExamPreview from "./pages/instructorPage/ExamPreview.jsx";
import OpenRoomSuccess from "./pages/instructorPage/OpenRoomSuccess.jsx";
import PublishedResultsList from "./pages/instructorPage/PublishedResultsList.jsx";
import Result from "./pages/instructorPage/Result.jsx";
import Setting from "./pages/instructorPage/Setting.jsx";
import EditExam from "./pages/instructorPage/EditExam.jsx";

import StudentDashboard from "./pages/studentPage/StudentDashboard.jsx";
import PrepareExam from "./pages/studentPage/PrepareExam.jsx";
import TakeExam from "./pages/studentPage/TakeExam.jsx";
import ResultsDashboard from "./pages/studentPage/ResultsDashboard.jsx";

import InstructorSidebar from "./components/instructor/InstructorSidebar.jsx";
import { UiProvider } from "./context/UiContext.jsx";
import Profile from "./pages/instructorPage/Profile.jsx";

import AdminDashboard from "./pages/adminPage/AdminDashboard.jsx";

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
    <UiProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <InstructorSidebar />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </UiProvider>
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
        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/role" element={<RolePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-room" element={<VerifyRoom />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />

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
          <Route path="/exam-bank" element={<ExamBank />} />
          <Route path="/assign-exam" element={<AssignExam />} />
          <Route path="/open-exam" element={<OpenExam />} />
          <Route path="/exam-settings/:examId" element={<ExamSettings />} />
          <Route path="/exams/:examId/preview" element={<ExamPreview />} />
          <Route path="/open-success/:examId" element={<OpenRoomSuccess />} />
          <Route path="/results-exams" element={<PublishedResultsList />} />
          <Route path="/result" element={<Result />} />
          <Route path="/setting" element={<Setting />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/instructor/exams/:id/edit" element={<EditExam />} />
        </Route>

        <Route
          path="/student-dashboard/results"
          element={
            <ProtectedRoute requiredRole="student">
              <ResultsDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/exam/:examId/prepare"
          element={
            <ProtectedRoute requiredRole="student">
              <PrepareExam />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exam/:examId/take"
          element={
            <ProtectedRoute requiredRole="student">
              <TakeExam />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
