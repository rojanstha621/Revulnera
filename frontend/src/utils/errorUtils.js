const TOAST_EVENT = "revulnera:toast";

function pushMessage(out, value) {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => pushMessage(out, item));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => pushMessage(out, item));
    return;
  }
  const normalized = String(value).trim();
  if (normalized) {
    out.push(normalized);
  }
}

export function extractErrorMessages(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const messages = [];

  if (payload.detail) {
    pushMessage(messages, payload.detail);
  }
  if (payload.error) {
    pushMessage(messages, payload.error);
  }

  Object.entries(payload).forEach(([key, value]) => {
    if (key.startsWith("_")) {
      return;
    }
    if (key === "detail" || key === "error") {
      return;
    }

    if (typeof value === "string") {
      pushMessage(messages, `${key}: ${value}`);
      return;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return;
      }
      pushMessage(messages, `${key}: ${value.join(" ")}`);
      return;
    }

    if (value && typeof value === "object") {
      const nested = [];
      pushMessage(nested, value);
      if (nested.length > 0) {
        pushMessage(messages, `${key}: ${nested.join(" ")}`);
      }
    }
  });

  return [...new Set(messages)];
}

export function getPrimaryErrorMessage(payload, fallback = "Request failed") {
  const messages = extractErrorMessages(payload);
  if (messages.length > 0) {
    return messages[0];
  }
  return fallback;
}

export function emitErrorToast(message) {
  const text = String(message || "").trim();
  if (!text || typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: {
        type: "error",
        message: text,
      },
    })
  );
}

export function getToastEventName() {
  return TOAST_EVENT;
}
