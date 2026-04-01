// src/pages/AdminUsers.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/adminApi";
import { Search, Filter } from "lucide-react";
import LoadingSpinner from "../components/admin/LoadingSpinner";
import ErrorAlert from "../components/admin/ErrorAlert";
import Pagination from "../components/admin/Pagination";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "user",
    is_active: true,
  });

  useEffect(() => {
    fetchUsers();
  }, [page, search, roleFilter, activeFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getUsers({
        page,
        page_size: 20,
        search,
        role: roleFilter,
        is_active: activeFilter,
      });
      if (data._status) {
        setError(data.detail || "Failed to load users");
      } else {
        setUsers(data.results || []);
        setTotalPages(data.total_pages || 1);
      }
    } catch (err) {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (e) => {
    setRoleFilter(e.target.value);
    setPage(1);
  };

  const handleActiveChange = (e) => {
    setActiveFilter(e.target.value);
    setPage(1);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError(null);
    const payload = {
      email: createForm.email.trim(),
      password: createForm.password,
      full_name: createForm.full_name.trim(),
      role: createForm.role,
      is_active: createForm.is_active,
    };

    const res = await adminApi.createUser(payload);
    if (res?._status) {
      setError(res.detail || "Failed to create user");
      return;
    }

    setCreateForm({ email: "", password: "", full_name: "", role: "user", is_active: true });
    setCreating(false);
    fetchUsers();
  };

  const handleDeleteUser = async (userId) => {
    const confirmed = window.confirm("Delete this user? This action cannot be undone.");
    if (!confirmed) return;

    setError(null);
    const res = await adminApi.deleteUser(userId);
    if (res?._status && res._status !== 204) {
      setError(res.detail || "Failed to delete user");
      return;
    }
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <p className="text-gray-400 mt-1">Monitor and manage all users in the system</p>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Filters */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg text-white transition"
          >
            {creating ? "Close" : "Create User"}
          </button>
        </div>

        {creating && (
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              required
              type="email"
              placeholder="Email"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
            />
            <input
              required
              type="password"
              placeholder="Password"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
            />
            <input
              type="text"
              placeholder="Full name"
              value={createForm.full_name}
              onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
              className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
            />
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
              className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
            >
              <option value="user">User</option>
              <option value="analyst">Analyst</option>
              <option value="admin">Admin</option>
            </select>
            <button className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-white" type="submit">
              Save
            </button>
            <label className="md:col-span-5 text-sm text-gray-300 flex items-center gap-2">
              <input
                type="checkbox"
                checked={createForm.is_active}
                onChange={(e) => setCreateForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Active account
            </label>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email or name..."
              value={search}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-slate-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={handleRoleChange}
            className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-slate-500"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="analyst">Analyst</option>
            <option value="user">User</option>
          </select>

          {/* Active Filter */}
          <select
            value={activeFilter}
            onChange={handleActiveChange}
            className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-slate-500"
          >
            <option value="">All Users</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="overflow-x-auto border border-gray-700/50 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-900/50 border-b border-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Scans</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Joined</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-800/50 transition">
                    <td className="px-6 py-4 text-sm text-white">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{user.full_name || "—"}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        user.role === "admin" ? "bg-red-900/40 text-red-300" :
                        user.role === "analyst" ? "bg-blue-900/40 text-blue-300" :
                        "bg-gray-700/40 text-gray-300"
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300 font-semibold">{user.scan_count}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        user.is_active ? "bg-green-900/40 text-green-300" : "bg-gray-700/40 text-gray-400"
                      }`}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {new Date(user.date_joined).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-3">
                      <Link
                        to={`/admin/users/${user.id}`}
                        className="text-slate-400 hover:text-slate-300 transition"
                      >
                        View Details
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-400 hover:text-red-300 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
