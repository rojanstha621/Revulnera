// src/api/api.js
const API_ROOT = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
export const WS_ROOT = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse(res) {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (!res.ok) {
      return { detail: data.detail || data || "Request failed", _status: res.status };
    }
    return data;
  } catch {
    return {
      detail: `Non-JSON response (${res.status}). First 200 chars: ${text.slice(0, 200)}`,
      _status: res.status,
      _raw: text,
    };
  }
}

async function requestJSON(method, path, body, token) {
  // path MUST start with "/"
  const url = `${API_ROOT}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return parseResponse(res);
}

export function postJSON(path, body, token) {
  return requestJSON("POST", path, body, token);
}

export function getJSON(path, token) {
  return requestJSON("GET", path, undefined, token);
}

export function putJSON(path, body, token) {
  return requestJSON("PUT", path, body, token);
}
