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

export function buildWsUrl(path) {
  const token = getAccessToken();
  const suffix = token ? `${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : "";
  return `${WS_ROOT}${path}${suffix}`;
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

async function requestFormData(method, path, formData, retry = true) {
  const url = `${API_ROOT}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      ...authHeader(),
    },
    body: formData,
  });

  if (res.status === 401 && retry && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return requestFormData(method, path, formData, false);
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

export function postFormData(path, formData) {
  return requestFormData("POST", path, formData);
}

export function logoutClient() {
  clearTokens();
}

export async function getKYCStatus() {
  return getJSON("/api/kyc/status/");
}

export async function submitKYC(formData) {
  return requestFormData("POST", "/api/kyc/submit/", formData);
}

/* =========================
   Scan API functions
========================= */
export async function getUserScans() {
  return getJSON("/api/recon/user/scans/");
}

export async function getUserScanDetail(scanId) {
  return getJSON(`/api/recon/user/scans/${scanId}/`);
}

/* =========================
   Report API functions
========================= */
// Fetch scan list with lightweight metrics for the Reports selection table.
// dateRange supports: all, 7days, 30days.
export async function getReportsSummary(dateRange = "all") {
  return getJSON(`/api/recon/reports/scans/?range=${dateRange}`);
}

// Fetch full aggregated report payload for a specific scan id.
// This includes summary, critical findings, technologies, and detailed results.
export async function generateScanReport(scanId) {
  return getJSON(`/api/recon/reports/scans/${scanId}/`);
}

/* =========================
   Vulnerability Detection API functions
========================= */
export async function getVulnerabilityScans() {
  return getJSON("/api/vulnerability-detection/scans/");
}

export async function getVulnerabilityScanDetail(scanId) {
  return getJSON(`/api/vulnerability-detection/scans/${scanId}/`);
}

export async function createVulnerabilityScan(data) {
  return postJSON("/api/vulnerability-detection/scans/", data);
}

export async function executeVulnerabilityScan(scanId) {
  return postJSON(`/api/vulnerability-detection/scans/${scanId}/execute/`);
}

export async function cancelVulnerabilityScan(scanId) {
  return postJSON(`/api/vulnerability-detection/scans/${scanId}/cancel/`);
}

export async function getSystemHealth() {
  return getJSON("/api/system/health/");
}

export async function getSystemMetrics() {
  return getJSON("/api/system/metrics/");
}

export async function getVulnerabilityFindings(scanId = null) {
  const path = scanId 
    ? `/api/vulnerability-detection/findings/?vulnerability_scan=${scanId}`
    : "/api/vulnerability-detection/findings/";
  return getJSON(path);
}

export async function getVulnerabilityLogs(scanId = null) {
  const path = scanId
    ? `/api/vulnerability-detection/logs/?vulnerability_scan=${scanId}`
    : "/api/vulnerability-detection/logs/";
  return getJSON(path);
}

/* =========================
   Domain verification API functions
========================= */
export async function getDomainVerifications() {
  return getJSON("/api/vulnerability-detection/domain-verifications/");
}

export async function createDomainVerification(data) {
  return postJSON("/api/vulnerability-detection/domain-verifications/", data);
}

export async function verifyDomainChallenge(verificationId) {
  return postJSON(`/api/vulnerability-detection/domain-verifications/${verificationId}/verify/`);
}

export async function submitDomainManualProof(verificationId, formData) {
  return postFormData(
    `/api/vulnerability-detection/domain-verifications/${verificationId}/submit_manual_proof/`,
    formData
  );
}

export async function getBugBountyScopes() {
  return getJSON("/api/vulnerability-detection/bug-bounty-scopes/");
}

/* =========================
   Subscription API functions
========================= */
function normalizeSubscriptionResponse(subscription) {
  if (!subscription || typeof subscription !== "object") {
    return subscription;
  }

  const plan = subscription.plan || {};
  const maxScansPerMonth = plan.max_scans_per_month;
  const maxStorageGb = plan.max_storage_gb;

  const defaultUsage = {
    scans_used_this_month: 0,
    scans_remaining:
      maxScansPerMonth === null || maxScansPerMonth === undefined
        ? null
        : maxScansPerMonth,
    current_storage_used_gb: 0,
    storage_remaining_gb:
      maxStorageGb === null || maxStorageGb === undefined
        ? null
        : maxStorageGb,
    api_calls_today: 0,
    usage_period_start: subscription.current_period_start || null,
    last_updated: subscription.updated_at || null,
    plan_name: plan.display_name || plan.name || "Free",
  };

  return {
    ...subscription,
    usage: {
      ...defaultUsage,
      ...(subscription.usage || {}),
    },
  };
}

export async function getSubscriptionPlans() {
  return getJSON("/auth/subscription/plans/");
}

export async function getUserSubscription() {
  const subscription = await getJSON("/auth/subscription/me/");
  return normalizeSubscriptionResponse(subscription);
}

export async function upgradSubscription(planId, reason = "") {
  return postJSON("/auth/subscription/upgrade/", { plan_id: planId, reason });
}

// Preferred spelling for new calls.
export async function upgradeSubscription(planId, reason = "") {
  return upgradSubscription(planId, reason);
}

// History endpoint is not implemented yet on backend, return empty collection
// so existing UI can continue rendering safely.
export async function getSubscriptionHistory() {
  return [];
}

