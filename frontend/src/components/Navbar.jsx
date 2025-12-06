// src/components/Navbar.jsx
import React, { useState, useContext } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const { isAuthenticated, auth, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const navigation = [
    { name: "Dashboard", href: "/" },
    { name: "Scanners", href: "/scanners" },
    { name: "Logs", href: "/logs" },
    { name: "Reports", href: "/reports" },
  ];

  const handleLogout = () => {
    logout();
    setAvatarOpen(false);
    setMobileOpen(false);
    navigate("/auth/login");
  };

  const activeLinkClass =
    "text-purple-400 border-b-2 border-purple-500 pb-1";
  const baseLinkClass = "text-gray-300 hover:text-purple-400 transition pb-1";

  return (
    <nav className="bg-gray-900 border-b border-purple-600/40 sticky top-0 z-50 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* BRAND */}
        <Link
          to={isAuthenticated ? "/" : "/auth/login"}
          className="text-xl font-bold text-purple-400 tracking-wide"
        >
          Revulnera
        </Link>

        {/* DESKTOP NAV */}
        {isAuthenticated && (
          <div className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  isActive ? activeLinkClass : baseLinkClass
                }
              >
                {item.name}
              </NavLink>
            ))}
          </div>
        )}

        {/* USER / AUTH MENU (DESKTOP) */}
        <div className="hidden md:flex items-center space-x-4">
          {!isAuthenticated ? (
            <>
              <Link
                to="/auth/login"
                className="text-gray-300 hover:text-purple-400"
              >
                Login
              </Link>
              <Link to="/auth/register" className="btn-primary text-sm">
                Sign Up
              </Link>
            </>
          ) : (
            <div className="relative">
              <button
                onClick={() => setAvatarOpen((v) => !v)}
                className="flex items-center space-x-2 focus:outline-none"
              >
                <img
                  src="https://api.dicebear.com/7.x/bottts/svg?seed=boss"
                  alt="avatar"
                  className="w-8 h-8 rounded-full border-2 border-purple-500/50"
                />
                <div className="text-left text-xs leading-tight">
                  <p className="text-gray-200">
                    {auth?.user?.full_name || "User"}
                  </p>
                  <p className="text-gray-400 truncate max-w-[140px]">
                    {auth?.user?.email || ""}
                  </p>
                </div>
                <ChevronDown size={18} className="text-gray-300" />
              </button>

              {avatarOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-gray-800 shadow-lg border border-purple-500/30 rounded-lg p-2">
                  <Link
                    to="/profile"
                    className="block px-3 py-2 rounded hover:bg-purple-600/30 text-gray-200"
                    onClick={() => setAvatarOpen(false)}
                  >
                    Profile
                  </Link>
                  <Link
                    to="/settings"
                    className="block px-3 py-2 rounded hover:bg-purple-600/30 text-gray-200"
                    onClick={() => setAvatarOpen(false)}
                  >
                    Settings
                  </Link>
                  <a
                    href="http://localhost:8000/admin"
                    className="block px-3 py-2 rounded hover:bg-purple-600/30 text-gray-200"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Admin
                  </a>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 rounded text-red-400 hover:bg-red-600/20"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MOBILE TOGGLE */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden text-gray-200"
        >
          {mobileOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="md:hidden bg-gray-800 border-t border-purple-600/40 px-6 py-4 space-y-2">
          {!isAuthenticated && (
            <>
              <Link
                to="/auth/login"
                className="block py-2 text-gray-300 hover:text-purple-400"
                onClick={() => setMobileOpen(false)}
              >
                Login
              </Link>
              <Link
                to="/auth/register"
                className="block py-2 text-gray-300 hover:text-purple-400"
                onClick={() => setMobileOpen(false)}
              >
                Sign Up
              </Link>
            </>
          )}

          {isAuthenticated && (
            <>
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `block py-2 ${
                      isActive
                        ? "text-purple-400"
                        : "text-gray-300 hover:text-purple-400"
                    }`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  {item.name}
                </NavLink>
              ))}

              <hr className="my-3 border-purple-600/20" />

              <NavLink
                to="/profile"
                className="block py-2 text-gray-300 hover:text-purple-400"
                onClick={() => setMobileOpen(false)}
              >
                Profile
              </NavLink>
              <NavLink
                to="/settings"
                className="block py-2 text-gray-300 hover:text-purple-400"
                onClick={() => setMobileOpen(false)}
              >
                Settings
              </NavLink>
              <a
                href="http://localhost:8000/admin"
                className="block py-2 text-gray-300 hover:text-purple-400"
                target="_blank"
                rel="noreferrer"
              >
                Admin
              </a>
              <button
                onClick={handleLogout}
                className="block w-full text-left py-2 text-red-400 hover:text-red-500"
              >
                Logout
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
