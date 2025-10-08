import React from "react";

export default function WhoAreYou() {
  const handleChooseRole = (role) => {
    if (role === "teacher") {
      window.location.href = "/teacher-login";
    } else if (role === "student") {
      window.location.href = "/student-login";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100 relative">
      {/* Logo */}
      <div className="absolute top-10 left-10 flex flex-col items-center">
        <img
          src="/assets/logo.png"
          alt="logo"
          className="h-10 mb-1"
        />
        <h2 className="text-blue-600 font-semibold text-lg">
          Online Examination
        </h2>
      </div>

      {/* Main Box */}
      <div className="bg-white border-2 border-gray-300 rounded-3xl shadow-lg px-16 py-12 text-center">
        <div className="flex items-center justify-center mb-8">
          <img
            src="/assets/user-icon.png"
            alt="icon"
            className="w-10 h-10 mr-3"
          />
          <h1 className="text-3xl font-bold text-gray-800">
            Bạn là ai? 👀
          </h1>
        </div>

        {/* Buttons */}
        <div className="flex gap-8 justify-center">
          <button
            onClick={() => handleChooseRole("teacher")}
            className="px-8 py-3 border-2 border-blue-600 text-blue-600 rounded-xl font-semibold text-xl hover:bg-blue-600 hover:text-white transition-all"
          >
            Giáo viên
          </button>
          <button
            onClick={() => handleChooseRole("student")}
            className="px-8 py-3 border-2 border-blue-600 text-blue-600 rounded-xl font-semibold text-xl hover:bg-blue-600 hover:text-white transition-all"
          >
            Học viên
          </button>
        </div>
      </div>
    </div>
  );
}
