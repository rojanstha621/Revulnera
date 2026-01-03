// src/api/adminApi.js

const API_ROOT = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Helper to get auth header
function getAuthHeader() {
  const token = localStorage.getItem("access");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse(res) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return {
      detail: `Non-JSON response (${res.status})`,
      _status: res.status,
      _raw: text.slice(0, 200),
    };
  }

  if (!res.ok) {
    return {
      detail: data.detail || "Request failed",
      _status: res.status,
      ...data,
    };
  }

  return data;
}

export const adminApi = {
  // Dashboard
  getDashboard: async () => {
    const res = await fetch(`${API_ROOT}/api/recon/admin/dashboard/`, {
      headers: getAuthHeader(),
    });
    return parseResponse(res);
  },

  // Users
  getUsers: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.role) query.append("role", params.role);
    if (params.is_active !== undefined) query.append("is_active", params.is_active);
    if (params.search) query.append("search", params.search);
    if (params.page) query.append("page", params.page);
    if (params.page_size) query.append("page_size", params.page_size);

    const res = await fetch(`${API_ROOT}/api/recon/admin/users/?${query}`, {
      headers: getAuthHeader(),
    });
    return parseResponse(res);
  },

  getUserDetail: async (userId) => {
    const res = await fetch(`${API_ROOT}/api/recon/admin/users/${userId}/`, {
      headers: getAuthHeader(),
    });
    return parseResponse(res);
  },

  // Scans
  getScans: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append("status", params.status);
    if (params.user_id) query.append("user_id", params.user_id);
    if (params.search) query.append("search", params.search);
    if (params.page) query.append("page", params.page);
    if (params.page_size) query.append("page_size", params.page_size);

    const res = await fetch(`${API_ROOT}/api/recon/admin/scans/?${query}`, {
      headers: getAuthHeader(),
    });
    return parseResponse(res);
  },

  getScanDetail: async (scanId) => {
    const res = await fetch(`${API_ROOT}/api/recon/admin/scans/${scanId}/`, {
      headers: getAuthHeader(),
    });
    return parseResponse(res);
  },

  // Analytics
  getAnalytics: async (period = "30") => {
    const res = await fetch(`${API_ROOT}/api/recon/admin/analytics/?period=${period}`, {
      headers: getAuthHeader(),
    });
    return parseResponse(res);
  },
};
