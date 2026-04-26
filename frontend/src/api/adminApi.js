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
    if (params.is_active !== undefined && params.is_active !== "") query.append("is_active", params.is_active);
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

  createUser: async (payload) => {
    const res = await fetch(`${API_ROOT}/api/recon/admin/users/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    return parseResponse(res);
  },

  updateUser: async (userId, payload) => {
    const res = await fetch(`${API_ROOT}/api/recon/admin/users/${userId}/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    return parseResponse(res);
  },

  deleteUser: async (userId) => {
    const res = await fetch(`${API_ROOT}/api/recon/admin/users/${userId}/`, {
      method: "DELETE",
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

  // KYC
  getKYCQueue: async () => {
    const res = await fetch(`${API_ROOT}/api/recon/admin/kyc-queue/`, {
      headers: getAuthHeader(),
    });
    return parseResponse(res);
  },

  getKYCDetail: async (submissionId) => {
    const res = await fetch(`${API_ROOT}/api/recon/admin/kyc-detail/${submissionId}/`, {
      headers: getAuthHeader(),
    });
    return parseResponse(res);
  },

  approveKYC: async (submissionId) => {
    const res = await fetch(`${API_ROOT}/api/recon/admin/kyc-approve/${submissionId}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({}),
    });
    return parseResponse(res);
  },

  rejectKYC: async (submissionId, rejection_reason) => {
    const res = await fetch(`${API_ROOT}/api/recon/admin/kyc-reject/${submissionId}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ rejection_reason }),
    });
    return parseResponse(res);
  },

  getKYCFileBlobUrl: async (submissionId, fileField) => {
    const token = localStorage.getItem("access");
    const res = await fetch(`${API_ROOT}/api/recon/admin/kyc-file/${submissionId}/${fileField}/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      return { error: true, detail: `Failed to load ${fileField}` };
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    return { error: false, url: blobUrl };
  },

  // Domain proof review
  getDomainProofQueue: async () => {
    const res = await fetch(`${API_ROOT}/api/vulnerability-detection/admin/domain-proof-queue/`, {
      headers: getAuthHeader(),
    });
    return parseResponse(res);
  },

  getDomainProofDetail: async (verificationId) => {
    const res = await fetch(`${API_ROOT}/api/vulnerability-detection/admin/domain-proof-detail/${verificationId}/`, {
      headers: getAuthHeader(),
    });
    return parseResponse(res);
  },

  approveDomainProof: async (verificationId, manual_review_note = "") => {
    const res = await fetch(`${API_ROOT}/api/vulnerability-detection/admin/domain-proof-approve/${verificationId}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ manual_review_note }),
    });
    return parseResponse(res);
  },

  rejectDomainProof: async (verificationId, manual_review_note) => {
    const res = await fetch(`${API_ROOT}/api/vulnerability-detection/admin/domain-proof-reject/${verificationId}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ manual_review_note }),
    });
    return parseResponse(res);
  },

  getDomainProofFileBlobUrl: async (verificationId) => {
    const token = localStorage.getItem("access");
    const res = await fetch(`${API_ROOT}/api/vulnerability-detection/admin/domain-proof-file/${verificationId}/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      return { error: true, detail: "Failed to load domain proof image" };
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    return { error: false, url: blobUrl };
  },

  // Bug bounty scopes
  getBugBountyScopes: async () => {
    const res = await fetch(`${API_ROOT}/api/vulnerability-detection/bug-bounty-scopes/`, {
      headers: getAuthHeader(),
    });
    return parseResponse(res);
  },

  importBugBountyScopes: async (payload) => {
    const res = await fetch(`${API_ROOT}/api/vulnerability-detection/bug-bounty-scopes/import_scopes/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    return parseResponse(res);
  },
};
