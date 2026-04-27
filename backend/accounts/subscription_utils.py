"""Subscription helpers used by API views and scan services."""

from datetime import timedelta
from django.conf import settings
from django.utils import timezone

from .models import SubscriptionPlan, UserSubscription


PLAN_DEFAULTS = {
    "free": {
        "display_name": "FREE",
        "description": "Full scanner access with limited compute resources.",
        "price_per_month": 0,
        "max_scans_per_month": 20,
        "max_storage_gb": 2,
        "api_rate_limit_per_minute": 20,
        "support_level": "email",
        "advanced_reporting": True,
        "custom_integrations": True,
        "dedicated_account_manager": True,
        "max_concurrent_scans": 1,
        "worker_count": 1,
        "scan_queue_priority": 1,
        "max_scan_history": 30,
        "basic_modules_only": False,
        "full_owasp_top10": True,
        "full_export": True,
        "unlimited_history": True,
        "api_access": True,
    },
    "pro": {
        "display_name": "PRO",
        "description": "Full scanner access with medium compute pool and faster throughput.",
        "price_per_month": 2900,
        "max_scans_per_month": 200,
        "max_storage_gb": 100,
        "api_rate_limit_per_minute": 300,
        "support_level": "priority",
        "advanced_reporting": True,
        "custom_integrations": True,
        "dedicated_account_manager": True,
        "max_concurrent_scans": 3,
        "worker_count": 4,
        "scan_queue_priority": 5,
        "max_scan_history": 500,
        "basic_modules_only": False,
        "full_owasp_top10": True,
        "full_export": True,
        "unlimited_history": True,
        "api_access": True,
    },
    "plus": {
        "display_name": "PLUS",
        "description": "Full scanner access with maximum compute power and highest priority.",
        "price_per_month": 9900,
        "max_scans_per_month": None,
        "max_storage_gb": 1000,
        "api_rate_limit_per_minute": 2000,
        "support_level": "24/7",
        "advanced_reporting": True,
        "custom_integrations": True,
        "dedicated_account_manager": True,
        "max_concurrent_scans": 10,
        "worker_count": 10,
        "scan_queue_priority": 10,
        "max_scan_history": None,
        "basic_modules_only": False,
        "full_owasp_top10": True,
        "full_export": True,
        "unlimited_history": True,
        "api_access": True,
    },
}


FEATURE_MAP = {
    "basic_modules_only": "basic_modules_only",
    "full_owasp_top10": "full_owasp_top10",
    "full_export": "full_export",
    "api_access": "api_access",
    "unlimited_history": "unlimited_history",
    "priority_queue": "scan_queue_priority",
    "max_concurrent_scans": "max_concurrent_scans",
    "worker_count": "worker_count",
}


def ensure_default_plans():
    """Create or update FREE/PRO/PLUS plans with canonical defaults."""
    for plan_name, defaults in PLAN_DEFAULTS.items():
        SubscriptionPlan.objects.update_or_create(name=plan_name, defaults=defaults)


def get_or_create_user_subscription(user):
    """Return user subscription, auto-creating FREE if missing."""
    ensure_default_plans()
    free_plan = SubscriptionPlan.objects.get(name="free")
    subscription, _ = UserSubscription.objects.get_or_create(
        user=user,
        defaults={
            "plan": free_plan,
            "status": "active",
            "current_period_start": timezone.now(),
            "current_period_end": timezone.now() + timedelta(days=30),
            "payment_provider": "manual",
        },
    )
    return subscription


def get_user_plan(user):
    """Return the user's current plan, defaulting to FREE when missing."""
    return get_or_create_user_subscription(user).plan


def check_subscription_feature(user, feature_name):
    """Check whether a user has access to a feature by name.

    Returns bool for boolean features, and the raw numeric value for numeric limits.
    """
    plan = get_user_plan(user)
    attr = FEATURE_MAP.get(feature_name, feature_name)
    if not hasattr(plan, attr):
        return False
    return getattr(plan, attr)


def get_scan_limits(user):
    """Return scan limits relevant for request-time enforcement."""
    plan = get_user_plan(user)
    return {
        "plan": plan,
        "max_concurrent_scans": plan.max_concurrent_scans,
        "worker_count": plan.worker_count,
        "scan_queue_priority": plan.scan_queue_priority,
    }


def get_effective_worker_count(user, system_worker_cap, workload_size=None):
    """Return worker count bounded by system capacity and user's subscription plan.

    Args:
        user: Auth user owning the scan.
        system_worker_cap: Runtime/system computed worker limit.
        workload_size: Optional number of jobs/engines to run.
    """
    limits = get_scan_limits(user)
    max_workers = min(int(system_worker_cap), int(limits["worker_count"]))
    if workload_size is not None:
        max_workers = min(max_workers, int(workload_size))
    return max(max_workers, 1)


def _expire_stale_active_scans(user):
    """Mark stale PENDING/RUNNING scans as FAILED before concurrency checks.

    This avoids zombie rows permanently consuming a user's concurrent-scan budget
    after worker crashes or interrupted sessions.
    """
    stale_minutes = int(getattr(settings, "SCAN_STALE_MINUTES", 180))
    now = timezone.now()
    cutoff = now - timedelta(minutes=stale_minutes)

    user.scans.filter(
        status__in=["PENDING", "RUNNING"],
        updated_at__lt=cutoff,
    ).update(status="FAILED")

    user.vulnerability_scans.filter(
        status__in=["PENDING", "RUNNING"],
        updated_at__lt=cutoff,
    ).update(
        status="FAILED",
        completed_at=now,
        error_message="Scan marked FAILED automatically after stale worker timeout.",
    )


def can_start_scan(user):
    """Validate whether user can start another scan now."""
    if not user.can_run_vulnerability_scans:
        return False, "Vulnerability scanning is not yet approved for your account."

    _expire_stale_active_scans(user)

    limits = get_scan_limits(user)
    # Apply one shared parallel-scan budget across recon and vulnerability jobs.
    active_recon_scans = user.scans.filter(status__in=["PENDING", "RUNNING"]).count()
    active_vuln_scans = user.vulnerability_scans.filter(status__in=["PENDING", "RUNNING"]).count()
    active_scans = active_recon_scans + active_vuln_scans
    if active_scans >= limits["max_concurrent_scans"]:
        return (
            False,
            f"Concurrent scan limit reached for {limits['plan'].display_name} plan "
            f"({limits['max_concurrent_scans']} max). Upgrade to run more scans in parallel.",
        )
    return True, ""
