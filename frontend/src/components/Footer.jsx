// src/components/Footer.jsx
import React from "react";
import { Github, Twitter, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 border-t border-slate-800 mt-10">
      <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-10">
        {/* ABOUT */}
        <div>
          <div className="flex items-center space-x-2">
            <Shield className="text-cyan-300" />
            <h2 className="text-lg font-semibold text-cyan-300">
              Revulnera
            </h2>
          </div>
          <p className="mt-2 text-gray-400">
            A modular vulnerability analysis suite built for security
            researchers and learners.
          </p>
        </div>

        {/* QUICK LINKS */}
        <div>
          <h3 className="text-gray-300 font-semibold mb-3">Navigation</h3>
          <ul className="space-y-2">
            <li>
              <Link
                to="/"
                className="text-gray-400 hover:text-cyan-300 transition"
              >
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/scanners"
                className="text-gray-400 hover:text-cyan-300 transition"
              >
                Scanners
              </Link>
            </li>
            <li>
              <Link
                to="/reports"
                className="text-gray-400 hover:text-cyan-300 transition"
              >
                Reports
              </Link>
            </li>
          </ul>
        </div>

        {/* SOCIAL */}
        <div>
          <h3 className="text-gray-300 font-semibold mb-3">Connect</h3>
          <div className="flex space-x-4">
            <a
              href="#"
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800"
            >
              <Github className="text-gray-300" />
            </a>
            <a
              href="#"
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800"
            >
              <Twitter className="text-gray-300" />
            </a>
          </div>
        </div>
      </div>

      <div className="text-center py-5 text-gray-500 border-t border-slate-800">
        © {year} Revulnera — All rights reserved.
      </div>
    </footer>
  );
}
