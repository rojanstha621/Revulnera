# accounts/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import SubscriptionPlan
from .serializers import (
    RegisterSerializer,
    UserSerializer,
    ChangePasswordSerializer,
    SubscriptionPlanSerializer,
    UserSubscriptionSerializer,
    UpgradeSubscriptionSerializer,
)
from .utils import make_verify_token, verify_token
from .subscription_utils import get_or_create_user_subscription

User = get_user_model()

def api_error(message, code=status.HTTP_400_BAD_REQUEST, field=None):
    """Return errors in a predictable JSON shape for frontend handling."""
    # Consistent error structure for frontend
    payload = {"detail": message}
    if field:
        payload["field"] = field
    return Response(payload, status=code)

def send_verification_email(request, user):
    """Build signed verification URL and send it to the user's email."""
    token = make_verify_token(user.email)
    frontend = getattr(settings, "DEFAULT_FRONTEND_URL", "http://localhost:5173")
    # Send the user to the frontend verification route, which will call the backend
    # (frontend route: /auth/verify-email?token=...)
    verify_url = f"{frontend.rstrip('/')}/auth/verify-email?token={token}"

    send_mail(
        "Verify your Revulnera account",
        f"Click to verify your account: {verify_url}",
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )

class RegisterView(generics.CreateAPIView):
    """Create account and trigger email verification."""

    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        """Custom create flow to handle duplicate emails and verification setup."""
        # Check if user with this email already exists
        email = request.data.get("email")
        if email:
            existing = User.objects.filter(email=email).first()
            if existing:
                return api_error("Email already registered", code=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # New users must verify email before login.
        user.email_verified = False
        user.is_active = True
        user.save(update_fields=["email_verified", "is_active"])

        send_verification_email(request, user)

        return Response(
            {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "detail": "Registration successful. Verification email sent.",
            },
            status=status.HTTP_201_CREATED,
        )

class VerifyEmailView(APIView):
    """Verify email using a signed token from email link."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """Activate email verification state if token is valid and not expired."""
        token = request.GET.get("token")
        if not token:
            return api_error("token is required", field="token")

        email, err = verify_token(token, max_age_seconds=60 * 60 * 24)  # 24 hours
        if err:
            return api_error(err, code=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email).first()
        if not user:
            return api_error("User not found", code=status.HTTP_404_NOT_FOUND)

        if user.email_verified:
            return Response({"detail": "Email already verified."}, status=status.HTTP_200_OK)

        user.email_verified = True
        user.is_active = True
        user.save(update_fields=["email_verified", "is_active"])
        return Response({"detail": "Email verified successfully. You can now log in."})

class ResendVerificationView(APIView):
    """Resend verification link to users who have not verified yet."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """Find user by email and re-send verification email."""
        email = request.data.get("email")
        if not email:
            return api_error("email is required", field="email")

        user = User.objects.filter(email=email).first()
        if not user:
            return api_error("User not found", code=status.HTTP_404_NOT_FOUND)

        if user.email_verified:
            return api_error("Email already verified", code=status.HTTP_400_BAD_REQUEST)

        send_verification_email(request, user)
        return Response({"detail": "Verification email sent"})


class ValidateResetTokenView(APIView):
    """Validate password reset token (dev-friendly)"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """Check if password reset token exists before showing reset form."""
        token = request.GET.get("token")
        if not token:
            return api_error("token is required", field="token")

        from django_rest_passwordreset.models import ResetPasswordToken

        exists = ResetPasswordToken.objects.filter(key=token).exists()
        if not exists:
            return api_error("Invalid or expired token", code=status.HTTP_400_BAD_REQUEST)

        return Response({"ok": True})

class LogoutView(APIView):
    """Invalidate refresh token by blacklisting it."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Logout endpoint expects refresh token in request body."""
        refresh = request.data.get("refresh")
        if not refresh:
            return api_error("refresh token required", field="refresh")

        try:
            token = RefreshToken(refresh)
            token.blacklist()
            return Response({"detail": "Logged out"})
        except Exception:
            return api_error("Invalid refresh token", code=status.HTTP_400_BAD_REQUEST)

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer that includes user role and other info"""
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['email'] = user.email
        token['full_name'] = user.full_name
        token['role'] = user.role
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        token['email_verified'] = getattr(user, 'email_verified', True)
        token['can_run_vulnerability_scans'] = user.can_run_vulnerability_scans
        return token

class CustomTokenObtainPairView(TokenObtainPairView):
    """Login endpoint with pre-check for email verification."""

    serializer_class = CustomTokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        """Authenticate user, block unverified accounts, and return JWT pair."""
        email = (request.data.get("email") or "").strip().lower()
        if email:
            account = User.objects.filter(email=email).first()
            if account and not account.email_verified:
                return api_error("Email not verified. Please verify from your inbox.", code=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            return api_error("Invalid credentials", code=status.HTTP_401_UNAUTHORIZED)

        user = getattr(serializer, "user", None)
        
        # update IP
        if user:
            ip = request.META.get("REMOTE_ADDR")
            user.last_login_ip = ip
            user.save(update_fields=["last_login_ip"])

        return Response(serializer.validated_data, status=status.HTTP_200_OK)

class ProfileView(generics.RetrieveUpdateAPIView):
    """Get and update currently logged-in user's account/profile."""

    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

class ChangePasswordView(generics.UpdateAPIView):
    """Allow authenticated user to change their password."""

    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        """Validate old/new passwords and persist the change."""
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password updated successfully"})


class SubscriptionPlanListView(generics.ListAPIView):
    """List all active subscription plans for pricing UI."""

    permission_classes = [permissions.AllowAny]
    serializer_class = SubscriptionPlanSerializer

    def get_queryset(self):
        return SubscriptionPlan.objects.filter(is_active=True).order_by("price_per_month")


class MySubscriptionView(APIView):
    """Return authenticated user's current subscription state."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        subscription = get_or_create_user_subscription(request.user)
        serializer = UserSubscriptionSerializer(subscription)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UpgradeSubscriptionView(APIView):
    """Upgrade or downgrade subscription plan (payment provider integration stub)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = UpgradeSubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        plan_id = serializer.validated_data.get("plan_id")
        plan_name = serializer.validated_data.get("plan_name")
        reason = serializer.validated_data.get("reason", "")

        target_plan = None
        if plan_id:
            target_plan = SubscriptionPlan.objects.filter(id=plan_id, is_active=True).first()
        if not target_plan and plan_name:
            target_plan = SubscriptionPlan.objects.filter(name=plan_name, is_active=True).first()

        if not target_plan:
            return api_error("Requested plan not found", code=status.HTTP_404_NOT_FOUND)

        user_subscription = get_or_create_user_subscription(request.user)
        current_plan = user_subscription.plan

        if current_plan.id == target_plan.id:
            return Response(
                {
                    "detail": f"You are already on {target_plan.display_name}.",
                    "subscription": UserSubscriptionSerializer(user_subscription).data,
                },
                status=status.HTTP_200_OK,
            )

        # Payment integration stub:
        # 1) Create subscription/update call in Stripe or Razorpay when target plan is paid.
        # 2) Verify payment webhook signature and mark active only after successful event.
        # 3) Persist external subscription id into subscription_id.
        # 4) Handle failed payments by setting status to past_due.
        # This stub keeps behavior deterministic for local/dev environments.

        user_subscription.plan = target_plan
        user_subscription.status = "active"
        user_subscription.current_period_start = timezone.now()
        user_subscription.current_period_end = timezone.now() + timedelta(days=30)
        user_subscription.payment_provider = "manual"
        user_subscription.save(
            update_fields=[
                "plan",
                "status",
                "current_period_start",
                "current_period_end",
                "payment_provider",
                "updated_at",
            ]
        )

        action = "upgraded" if target_plan.price_per_month > current_plan.price_per_month else "changed"
        detail = f"Subscription {action} to {target_plan.display_name}."
        if reason:
            detail = f"{detail} Reason: {reason}"

        return Response(
            {
                "detail": detail,
                "subscription": UserSubscriptionSerializer(user_subscription).data,
            },
            status=status.HTTP_200_OK,
        )
