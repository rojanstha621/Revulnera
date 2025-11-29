// src/layouts/Layout.jsx
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 md:px-8 py-6">
        {children}
      </main>

      <Footer />
    </div>
  );
}
