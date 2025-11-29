// src/components/Navbar.jsx
import { useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const navigation = [
    { name: "Dashboard", href: "/" },
    { name: "Scanners", href: "/scanners" },
    { name: "Logs", href: "/logs" },
    { name: "Reports", href: "/reports" },
    // { name: "Admin", href: "http://localhost:8000/admin" },
    // { name: "Sign Up", href: "/auth/register" },
  ];

  return (
    <nav className="bg-gray-900 border-b border-purple-600/40 sticky top-0 z-50 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        
        {/* BRAND */}
        <a href="/" className="text-xl font-bold text-purple-400 tracking-wide">
          Revulnera
        </a>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex space-x-8">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="text-gray-300 hover:text-purple-400 transition"
            >
              {item.name}
            </a>
          ))}
        </div>

        {/* USER MENU */}
        <div className="relative hidden md:block">
          <button
            onClick={() => setAvatarOpen(!avatarOpen)}
            className="flex items-center space-x-2 focus:outline-none"
          >
            <img
              src="https://api.dicebear.com/7.x/bottts/svg?seed=boss"
              alt="avatar"
              className="w-8 h-8 rounded-full border-2 border-purple-500/50"
            />
            <ChevronDown size={18} className="text-gray-300" />
          </button>

          {avatarOpen && (
            <div className="absolute right-0 mt-3 w-48 bg-gray-800 shadow-lg border border-purple-500/30 rounded-lg p-2">
              <a
                href="/profile"
                className="block px-3 py-2 rounded hover:bg-purple-600/30 text-gray-200"
              >
                Profile
              </a>
              <a
                href="/settings"
                className="block px-3 py-2 rounded hover:bg-purple-600/30 text-gray-200"
              >
                Settings
              </a>
              <a
                href="/auth/register"
                className="block px-3 py-2 rounded hover:bg-purple-600/30 text-gray-200"
              >
                Sign Up
              </a>
              <a
                href="http://localhost:8000/admin"
                className="block px-3 py-2 rounded hover:bg-purple-600/30 text-gray-200"
              >
                Admin
              </a>
              <a
                href="/logout"
                className="block px-3 py-2 rounded text-red-400 hover:bg-red-600/20"
              >
                Logout
              </a>
            </div>
          )}
        </div>

        {/* MOBILE TOGGLE */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-gray-200"
        >
          {mobileOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="md:hidden bg-gray-800 border-t border-purple-600/40 px-6 py-4">
          {navigation.map((item) => (
            <a
              key={item.name}
              className="block py-2 text-gray-300 hover:text-purple-400"
              href={item.href}
            >
              {item.name}
            </a>
          ))}

          <hr className="my-3 border-purple-600/20" />

          <a href="/profile" className="block py-2 text-gray-300 hover:text-purple-400">
            Profile
          </a>
          <a href="/settings" className="block py-2 text-gray-300 hover:text-purple-400">
            Settings
          </a>
          <a href="/auth/register" className="block py-2 text-gray-300 hover:text-purple-400">
            Sign Up
          </a>
          <a href="http://localhost:8000/admin" className="block py-2 text-gray-300 hover:text-purple-400">
            Admin
          </a>
          <a href="/logout" className="block py-2 text-red-400 hover:text-red-600/40">
            Logout
          </a>
        </div>
      )}
    </nav>
  );
}
