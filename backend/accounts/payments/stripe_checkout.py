"""Stripe Checkout helpers for subscription payments."""

from __future__ import annotations

from typing import Any

import requests
from django.conf import settings

STRIPE_API_BASE = "https://api.stripe.com/v1"
DEFAULT_CURRENCY = "usd"


class StripeAPIError(RuntimeError):
    """Raised when Stripe returns an unexpected response."""


def _stripe_secret_key() -> str:
    secret_key = getattr(settings, "STRIPE_SECRET_KEY", "") or ""
    if not secret_key:
        raise StripeAPIError("Stripe is not configured")
    return secret_key


def _request(method: str, path: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    response = requests.request(
        method,
        f"{STRIPE_API_BASE}{path}",
        data=data or {},
        auth=(_stripe_secret_key(), ""),
        timeout=20,
    )

    try:
        payload = response.json() if response.content else {}
    except ValueError as exc:
        raise StripeAPIError("Stripe returned a non-JSON response") from exc

    if response.status_code >= 400:
        error_detail = payload.get("error", {}).get("message") if isinstance(payload, dict) else None
        raise StripeAPIError(error_detail or f"Stripe request failed with status {response.status_code}")

    if not isinstance(payload, dict):
        raise StripeAPIError("Stripe returned an unexpected payload")

    return payload


def create_checkout_session(*, transaction, user, plan, success_url: str, cancel_url: str) -> dict[str, Any]:
    """Create a Stripe Checkout Session for a paid subscription plan."""

    payload: dict[str, Any] = {
        "mode": "subscription",
        "customer_email": user.email,
        "client_reference_id": str(transaction.id),
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata[user_id]": str(user.id),
        "metadata[plan_id]": str(plan.id),
        "metadata[transaction_id]": str(transaction.id),
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": DEFAULT_CURRENCY,
        "line_items[0][price_data][product_data][name]": plan.display_name,
        "line_items[0][price_data][product_data][description]": plan.description or plan.display_name,
        "line_items[0][price_data][unit_amount]": str(plan.price_per_month),
        "line_items[0][price_data][recurring][interval]": "month",
    }

    return _request("POST", "/checkout/sessions", payload)


def retrieve_checkout_session(session_id: str) -> dict[str, Any]:
    """Fetch a Stripe Checkout Session by id for backend verification."""

    return _request("GET", f"/checkout/sessions/{session_id}")
