// src/components/Layout.jsx
import React, { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import Navbar from "./Navbar";
import AdminNavbar from "./AdminNavbar";
import Footer from "./Footer";

export default function Layout({ children }) {
  const { auth } = useContext(AuthContext);
  const isAdmin = auth?.user?.role === "admin";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {isAdmin ? <AdminNavbar /> : <Navbar />}
      <main className="flex-1 px-4 md:px-8 py-6">{children}</main>
      <Footer />
    </div>
  );
}
