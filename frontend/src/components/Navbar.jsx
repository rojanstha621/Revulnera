// src/components/Navbar.jsx
import React, { useState, useContext } from "react";
import { Menu, X, ChevronDown, Shield, Zap, Home, Settings } from "lucide-react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const { isAuthenticated, auth, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const userNavigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Scanners", href: "/scanners", icon: Zap },
    { name: "Scans", href: "/scans", icon: Shield },
    { name: "Logs", href: "/logs", icon: Shield },
    { name: "Reports", href: "/reports", icon: Shield },
  ];

  const handleLogout = () => {
    logout();
    setAvatarOpen(false);
    setMobileOpen(false);
    navigate("/auth/login");
  };

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-gray-950/80 border-b border-gradient-to-r from-purple-600/40 via-pink-600/20 to-purple-600/40">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        
        {/* BRAND */}
        <Link
          to="/"
          className="flex items-center gap-2 group cursor-pointer"
        >
          <img 
            src="/logoImage.png" 
            alt="Revulnera Logo" 
            className="w-10 h-10 rounded-lg shadow-lg shadow-purple-500/50 group-hover:shadow-purple-500/70 transition-all object-contain"
          />
          <span className="text-2xl font-bold text-gradient hidden sm:inline">
            Revulnera
          </span>
        </Link>

        {/* DESKTOP NAV */}
        {isAuthenticated && (
          <div className="hidden lg:flex items-center gap-2">
            {userNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    isActive
                      ? "flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/30 text-purple-300 border border-purple-500/50 font-semibold transition-all"
                      : "flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:text-purple-400 hover:bg-purple-600/10 transition-all"
                  }
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </NavLink>
              );
            })}
          </div>
        )}

        {/* RIGHT SIDE MENU */}
        <div className="flex items-center gap-4">
          {!isAuthenticated ? (
            <>
              <Link
                to="/auth/login"
                className="text-gray-300 hover:text-purple-400 font-semibold transition-colors"
              >
                Login
              </Link>
              <Link to="/auth/register" className="btn-primary text-sm">
                Sign Up
              </Link>
            </>
          ) : (
            <div className="hidden md:flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setAvatarOpen((v) => !v)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all border border-white/0 hover:border-purple-500/30"
                >
                  <div className="text-left text-sm">
                    <p className="text-gray-100 font-semibold truncate max-w-[150px]">
                      {auth?.user?.full_name || "User"}
                    </p>
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${avatarOpen ? "rotate-180" : ""}`} />
                </button>

                {avatarOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-gray-900 border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-500/10 p-2 backdrop-blur-md">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-white font-semibold">{auth?.user?.full_name}</p>
                    </div>

                    <Link
                      to="/profile"
                      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-purple-600/20 text-gray-300 hover:text-purple-300 transition-all"
                      onClick={() => setAvatarOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Profile Settings
                    </Link>

                    <Link
                      to="/change-password"
                      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-purple-600/20 text-gray-300 hover:text-purple-300 transition-all"
                      onClick={() => setAvatarOpen(false)}
                    >
                      <Shield className="w-4 h-4" />
                      Change Password
                    </Link>

                    <hr className="my-2 border-white/10" />

                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 rounded-lg text-red-400 hover:bg-red-600/20 hover:text-red-300 transition-all font-semibold"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MOBILE MENU BUTTON */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden text-gray-200 hover:text-purple-400 transition-colors"
          >
            {mobileOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {mobileOpen && isAuthenticated && (
        <div className="lg:hidden bg-gradient-to-b from-gray-900 to-gray-950 border-t border-purple-600/40 px-4 py-4 space-y-2 backdrop-blur-md">
          {userNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  isActive
                    ? "flex items-center gap-3 px-4 py-3 rounded-lg bg-purple-600/30 text-purple-300 font-semibold transition-all"
                    : "flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-purple-600/20 transition-all"
                }
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            );
          })}

          <hr className="my-4 border-purple-600/20" />

          <Link
            to="/profile"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-purple-600/20 transition-all"
            onClick={() => setMobileOpen(false)}
          >
            <Settings className="w-5 h-5" />
            Profile
          </Link>

          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-600/20 transition-all font-semibold"
          >
            <X className="w-5 h-5" />
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
