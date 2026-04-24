# accounts/models.py
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils import timezone

class UserManager(BaseUserManager):
    """Custom manager so users are created with email instead of username."""

    def create_user(self, email, password=None, **extra_fields):
        """Create a normal user account."""
        if not email:
            raise ValueError("Email required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create an admin/superuser with required flags."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", "admin")
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("role") != "admin":
            raise ValueError("Superuser must have role='admin'.")
        return self.create_user(email, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    """Application user model used across all backend modules."""

    ROLE_CHOICES = (
        ("admin", "Admin"),
        ("analyst", "Analyst"),
        ("user", "User"),
    )

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default="user")

    # account lifecycle: email verification and admin activation are separate
    email_verified = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    
    # vulnerability scanning approval
    can_run_vulnerability_scans = models.BooleanField(
        default=False,
        help_text="User needs admin approval to run vulnerability scans"
    )

    # audit
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    last_password_change = models.DateTimeField(null=True, blank=True)

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class UserProfile(models.Model):
    """Optional profile details separated from core auth fields."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    phone = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=255, blank=True)
    profile_image = models.ImageField(upload_to="profiles/", null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile({self.user.email})"


class SubscriptionPlan(models.Model):
    """Defines product tiers and feature/limit entitlements."""

    PLAN_CHOICES = (
        ("free", "Free"),
        ("pro", "Pro"),
        ("plus", "Plus"),
    )

    name = models.CharField(max_length=20, choices=PLAN_CHOICES, unique=True)
    display_name = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    price_per_month = models.PositiveIntegerField(default=0, help_text="Price in cents")

    # Legacy-compatible limits retained for existing API/UI usage.
    max_scans_per_month = models.IntegerField(
        null=True,
        blank=True,
        help_text="null = unlimited monthly scans",
    )
    max_storage_gb = models.PositiveIntegerField(default=1)
    api_rate_limit_per_minute = models.PositiveIntegerField(default=10)
    support_level = models.CharField(max_length=20, default="email")
    advanced_reporting = models.BooleanField(default=False)
    custom_integrations = models.BooleanField(default=False)
    dedicated_account_manager = models.BooleanField(default=False)

    # Capacity and execution controls
    max_concurrent_scans = models.PositiveIntegerField(default=1)
    worker_count = models.PositiveIntegerField(default=1, help_text="Worker threads/processes assigned in Go scanner")
    scan_queue_priority = models.PositiveIntegerField(default=1, help_text="Higher means higher queue priority")
    max_scan_history = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="How many historical scans are retained. null = unlimited",
    )

    # Feature switches
    basic_modules_only = models.BooleanField(default=True)
    full_owasp_top10 = models.BooleanField(default=False)
    full_export = models.BooleanField(default=False)
    unlimited_history = models.BooleanField(default=False)
    api_access = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["price_per_month"]

    def __str__(self):
        return f"{self.display_name} (${self.price_per_month / 100:.2f}/mo)"


class UserSubscription(models.Model):
    """Tracks each user's active plan and billing period metadata."""

    STATUS_CHOICES = (
        ("active", "Active"),
        ("canceled", "Canceled"),
        ("expired", "Expired"),
        ("past_due", "Past Due"),
    )

    PROVIDER_CHOICES = (
        ("manual", "Manual"),
        ("stripe", "Stripe"),
        ("razorpay", "Razorpay"),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="subscription")
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    current_period_start = models.DateTimeField(default=timezone.now)
    current_period_end = models.DateTimeField()
    auto_renew = models.BooleanField(default=True)

    payment_provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default="manual")
    subscription_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        unique=True,
        help_text="External subscription id from Stripe/Razorpay",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Subscription"
        verbose_name_plural = "User Subscriptions"

    @property
    def is_active(self):
        return self.status == "active" and self.current_period_end >= timezone.now()

    @property
    def days_remaining(self):
        delta = self.current_period_end - timezone.now()
        return max(delta.days, 0)

    def __str__(self):
        return f"{self.user.email} - {self.plan.display_name}"
