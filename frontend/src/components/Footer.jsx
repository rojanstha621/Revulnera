// src/components/Footer.jsx
import { Github, Twitter, Shield } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-purple-600/40 mt-10">
      <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-10">

        {/* ABOUT */}
        <div>
          <div className="flex items-center space-x-2">
            <Shield className="text-purple-400" />
            <h2 className="text-lg font-semibold text-purple-400">Revulnera</h2>
          </div>
          <p className="mt-2 text-gray-400">
            A modular vulnerability analysis suite built for security researchers and learners.
          </p>
        </div>

        {/* QUICK LINKS */}
        <div>
          <h3 className="text-gray-300 font-semibold mb-3">Navigation</h3>
          <ul className="space-y-2">
            <li><a href="/" className="text-gray-400 hover:text-purple-400">Dashboard</a></li>
            <li><a href="/scanners" className="text-gray-400 hover:text-purple-400">Scanners</a></li>
            <li><a href="/logs" className="text-gray-400 hover:text-purple-400">Logs</a></li>
            <li><a href="/reports" className="text-gray-400 hover:text-purple-400">Reports</a></li>
          </ul>
        </div>

        {/* SOCIAL */}
        <div>
          <h3 className="text-gray-300 font-semibold mb-3">Connect</h3>
          <div className="flex space-x-4">
            <a href="#" className="p-2 rounded-lg bg-gray-800 hover:bg-purple-600/40">
              <Github className="text-gray-300" />
            </a>
            <a href="#" className="p-2 rounded-lg bg-gray-800 hover:bg-purple-600/40">
              <Twitter className="text-gray-300" />
            </a>
          </div>
        </div>
      </div>

      <div className="text-center py-5 text-gray-500 border-t border-purple-600/10">
        © {new Date().getFullYear()} Revulnera — All rights reserved.
      </div>
    </footer>
  );
}
