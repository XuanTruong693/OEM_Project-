// src/components/Layout.jsx
import React from "react";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";
import { Outlet } from "react-router-dom";

const Layout = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-r from-[#e7f7ff] to-[#fff0fb] shadow-lg font-sans">
      <Navbar />
      <Outlet />
      <main className="flex-1 p-4">{children}</main>
      <Footer />
    </div>
  );
};

export default Layout;
