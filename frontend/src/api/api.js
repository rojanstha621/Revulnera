const API_ROOT = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

async function parseResponse(res) {
  const text = await res.text();

  // Try JSON first
  try {
    const data = JSON.parse(text);
    if (!res.ok) {
      return { detail: data.detail || data || "Request failed", _status: res.status };
    }
    return data;
  } catch {
    // Not JSON (likely HTML error page)
    return {
      detail: `Non-JSON response (${res.status}). First 200 chars: ${text.slice(0, 200)}`,
      _status: res.status,
      _raw: text,
    };
  }
}

export async function postJSON(path, body, token) {
  const res = await fetch(`${API_ROOT}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  return parseResponse(res);
}

export async function getJSON(path, token) {
  const res = await fetch(`${API_ROOT}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return parseResponse(res);
}
