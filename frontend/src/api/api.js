// src/api/api.js

const API_ROOT =
  import.meta.env.VITE_API_URL || "http://localhost:8000";
export const WS_ROOT =
  import.meta.env.VITE_WS_URL || "ws://localhost:8000";

/* =========================
   Token helpers
========================= */
function getAccessToken() {
  return localStorage.getItem("access");
}

function getRefreshToken() {
  return localStorage.getItem("refresh");
}

function setTokens({ access, refresh }) {
  if (access) localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);
}

function clearTokens() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}

function authHeader() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* =========================
   Response parser
========================= */
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

/* =========================
   Core request
========================= */
async function requestJSON(method, path, body, retry = true) {
  const url = `${API_ROOT}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // If access token expired, try refresh ONCE
  if (res.status === 401 && retry && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return requestJSON(method, path, body, false);
    }
    clearTokens();
  }

  return parseResponse(res);
}

/* =========================
   Token refresh
========================= */
async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_ROOT}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    const data = await parseResponse(res);
    if (data.access) {
      setTokens({ access: data.access });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/* =========================
   Public helpers
========================= */
export function postJSON(path, body) {
  return requestJSON("POST", path, body);
}

export function getJSON(path) {
  return requestJSON("GET", path);
}

export function putJSON(path, body) {
  return requestJSON("PUT", path, body);
}

export function logoutClient() {
  clearTokens();
}
