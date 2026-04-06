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
