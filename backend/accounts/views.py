# accounts/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction as db_transaction
from django.utils import timezone
from datetime import timedelta
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import SubscriptionPlan, UserSubscription, StripeCheckoutTransaction
from .serializers import (
    RegisterSerializer,
    UserSerializer,
    ChangePasswordSerializer,
    SubscriptionPlanSerializer,
    UserSubscriptionSerializer,
    UpgradeSubscriptionSerializer,
    StripeCheckoutSessionCreateSerializer,
    StripeCheckoutSessionVerifySerializer,
    StripeCheckoutTransactionSerializer,
)
from .utils import make_verify_token, verify_token
from .subscription_utils import get_or_create_user_subscription
from .payments.stripe_checkout import StripeAPIError, create_checkout_session, retrieve_checkout_session

User = get_user_model()

def api_error(message, code=status.HTTP_400_BAD_REQUEST, field=None):
    """Return errors in a predictable JSON shape for frontend handling."""
    # Consistent error structure for frontend
    payload = {"detail": message}
    if field:
        payload["field"] = field
    return Response(payload, status=code)


def _get_target_plan(plan_id=None, plan_name=None):
    target_plan = None
    if plan_id:
        target_plan = SubscriptionPlan.objects.filter(id=plan_id, is_active=True).first()
    if not target_plan and plan_name:
        target_plan = SubscriptionPlan.objects.filter(name=plan_name, is_active=True).first()
    return target_plan


def _build_checkout_urls():
    frontend = getattr(settings, "DEFAULT_FRONTEND_URL", "http://localhost:5173")
    success_url = f"{frontend.rstrip('/')}/subscription/stripe/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{frontend.rstrip('/')}/plans"
    return success_url, cancel_url


def _activate_subscription_from_checkout(*, user_subscription, transaction_obj, session):
    subscription_id = session.get("subscription")
    payment_intent_id = session.get("payment_intent")
    response_payload = session if isinstance(session, dict) else {}

    user_subscription.plan = transaction_obj.plan
    user_subscription.status = "active"
    user_subscription.current_period_start = timezone.now()
    user_subscription.current_period_end = timezone.now() + timedelta(days=30)
    user_subscription.payment_provider = "stripe"
    if subscription_id:
        user_subscription.subscription_id = str(subscription_id)
    user_subscription.save(
        update_fields=[
            "plan",
            "status",
            "current_period_start",
            "current_period_end",
            "payment_provider",
            "subscription_id",
            "updated_at",
        ]
    )

    transaction_obj.subscription = user_subscription
    transaction_obj.status = "completed"
    transaction_obj.stripe_subscription_id = str(subscription_id) if subscription_id else transaction_obj.stripe_subscription_id
    transaction_obj.stripe_payment_intent_id = str(payment_intent_id) if payment_intent_id else transaction_obj.stripe_payment_intent_id
    transaction_obj.stripe_payment_status = session.get("payment_status", "")
    transaction_obj.response_payload = response_payload
    transaction_obj.failure_reason = ""
    transaction_obj.verified_at = timezone.now()
    transaction_obj.save(
        update_fields=[
            "subscription",
            "status",
            "stripe_subscription_id",
            "stripe_payment_intent_id",
            "stripe_payment_status",
            "response_payload",
            "failure_reason",
            "verified_at",
            "updated_at",
        ]
    )

    return user_subscription


def _mark_transaction_failed(transaction_obj, reason, response_payload=None):
    transaction_obj.status = "failed"
    transaction_obj.failure_reason = reason
    transaction_obj.response_payload = response_payload or transaction_obj.response_payload
    transaction_obj.verified_at = timezone.now()
    transaction_obj.save(
        update_fields=["status", "failure_reason", "response_payload", "verified_at", "updated_at"]
    )
    return transaction_obj


def _reconcile_existing_checkout(transaction_obj, subscription):
    """Sync a stored pending transaction with Stripe before refusing a new checkout."""

    if not transaction_obj.stripe_session_id:
        return None

    try:
        stripe_session = retrieve_checkout_session(transaction_obj.stripe_session_id)
    except StripeAPIError as exc:
        _mark_transaction_failed(transaction_obj, str(exc))
        return {
            "status": "failed",
            "detail": "You've either completed your payment or this checkout session has timed out.",
        }

    session_status = stripe_session.get("status")
    payment_status = stripe_session.get("payment_status")

    if session_status == "complete" or payment_status == "paid":
        if transaction_obj.status != "completed":
            _activate_subscription_from_checkout(
                user_subscription=subscription,
                transaction_obj=transaction_obj,
                session=stripe_session,
            )
        return {
            "status": "completed",
            "detail": "You're all done here.",
        }

    if session_status == "expired":
        _mark_transaction_failed(
            transaction_obj,
            "You've either completed your payment or this checkout session has timed out.",
            stripe_session,
        )
        return {
            "status": "expired",
            "detail": "You've either completed your payment or this checkout session has timed out.",
        }

    return {
        "status": "pending",
        "detail": "A Stripe checkout is already pending for this account.",
    }


def _serialize_checkout_transaction(transaction_obj):
    return StripeCheckoutTransactionSerializer(transaction_obj).data

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

        target_plan = _get_target_plan(plan_id=plan_id, plan_name=plan_name)

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

        if target_plan.price_per_month == 0:
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

        create_serializer = StripeCheckoutSessionCreateSerializer(data={"plan_id": target_plan.id, "reason": reason})
        create_serializer.is_valid(raise_exception=True)
        return StripeCheckoutCreateView().post(request, serializer=create_serializer, target_plan=target_plan)


class StripeCheckoutCreateView(APIView):
    """Create a Stripe Checkout session and persist a pending payment transaction."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, serializer=None, target_plan=None):
        serializer = serializer or StripeCheckoutSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        plan_id = serializer.validated_data.get("plan_id")
        plan_name = serializer.validated_data.get("plan_name")
        reason = serializer.validated_data.get("reason", "")

        if target_plan is None:
            target_plan = _get_target_plan(plan_id=plan_id, plan_name=plan_name)

        if not target_plan:
            return api_error("Requested plan not found", code=status.HTTP_404_NOT_FOUND)

        if target_plan.price_per_month <= 0:
            return api_error("Stripe checkout is only required for paid plans", code=status.HTTP_400_BAD_REQUEST)

        user_subscription = get_or_create_user_subscription(request.user)

        with db_transaction.atomic():
            user_subscription = UserSubscription.objects.select_for_update().get(pk=user_subscription.pk)

            existing_pending = (
                StripeCheckoutTransaction.objects.select_for_update()
                .filter(user=request.user, status="pending")
                .order_by("-created_at")
                .first()
            )
            if existing_pending:
                reconciliation = _reconcile_existing_checkout(existing_pending, user_subscription)
                if reconciliation and reconciliation.get("status") == "completed":
                    return Response(
                        {
                            "detail": reconciliation["detail"],
                            "subscription": UserSubscriptionSerializer(user_subscription).data,
                            "transaction": _serialize_checkout_transaction(existing_pending),
                        },
                        status=status.HTTP_200_OK,
                    )
                if reconciliation and reconciliation.get("status") == "expired":
                    existing_pending = None
                elif existing_pending.plan_id == target_plan.id and existing_pending.stripe_session_id:
                    return Response(
                        {
                            "sessionId": existing_pending.stripe_session_id,
                            "transaction": _serialize_checkout_transaction(existing_pending),
                            "detail": reconciliation["detail"] if reconciliation else "Checkout session already created.",
                        },
                        status=status.HTTP_200_OK,
                    )
                return api_error(
                    reconciliation["detail"] if reconciliation else "A Stripe checkout is already pending for this account.",
                    code=status.HTTP_409_CONFLICT,
                )

            transaction_obj = StripeCheckoutTransaction.objects.create(
                user=request.user,
                subscription=user_subscription,
                plan=target_plan,
                status="pending",
                amount=target_plan.price_per_month,
                currency="usd",
                request_payload={
                    "plan_id": target_plan.id,
                    "plan_name": target_plan.name,
                    "reason": reason,
                },
            )

            success_url, cancel_url = _build_checkout_urls()

            try:
                stripe_session = create_checkout_session(
                    transaction=transaction_obj,
                    user=request.user,
                    plan=target_plan,
                    success_url=success_url,
                    cancel_url=cancel_url,
                )
            except StripeAPIError as exc:
                _mark_transaction_failed(transaction_obj, str(exc))
                return api_error(str(exc), code=status.HTTP_502_BAD_GATEWAY)

            transaction_obj.stripe_session_id = stripe_session.get("id")
            transaction_obj.response_payload = stripe_session
            transaction_obj.save(update_fields=["stripe_session_id", "response_payload", "updated_at"])

        return Response(
            {
                "sessionId": transaction_obj.stripe_session_id,
                "transaction": _serialize_checkout_transaction(transaction_obj),
            },
            status=status.HTTP_201_CREATED,
        )


class StripeCheckoutVerifyView(APIView):
    """Verify a Stripe checkout session with Stripe before activating the subscription."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = StripeCheckoutSessionVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session_id = serializer.validated_data["session_id"]

        with db_transaction.atomic():
            transaction_obj = (
                StripeCheckoutTransaction.objects.select_for_update()
                .select_related("plan")
                .filter(user=request.user, stripe_session_id=session_id)
                .first()
            )

            if not transaction_obj:
                return api_error("Checkout session not found", code=status.HTTP_404_NOT_FOUND)

            if transaction_obj.status == "completed":
                subscription = transaction_obj.subscription or get_or_create_user_subscription(request.user)
                return Response(
                    {
                        "detail": "Checkout session already processed.",
                        "transaction": _serialize_checkout_transaction(transaction_obj),
                        "subscription": UserSubscriptionSerializer(subscription).data,
                    },
                    status=status.HTTP_200_OK,
                )

            if transaction_obj.status == "failed":
                return api_error(
                    transaction_obj.failure_reason or "Checkout session failed",
                    code=status.HTTP_400_BAD_REQUEST,
                )

            try:
                stripe_session = retrieve_checkout_session(session_id)
            except StripeAPIError as exc:
                _mark_transaction_failed(transaction_obj, str(exc))
                return api_error(str(exc), code=status.HTTP_502_BAD_GATEWAY)

            if str(stripe_session.get("client_reference_id") or "") != str(transaction_obj.id):
                _mark_transaction_failed(transaction_obj, "Stripe session does not match the stored transaction.", stripe_session)
                return api_error("Stripe session does not match the stored transaction.", code=status.HTTP_400_BAD_REQUEST)

            if stripe_session.get("payment_status") != "paid":
                _mark_transaction_failed(
                    transaction_obj,
                    "Stripe Checkout session has not been paid.",
                    stripe_session,
                )
                return api_error(
                    "Payment was not completed.",
                    code=status.HTTP_400_BAD_REQUEST,
                )

            subscription = get_or_create_user_subscription(request.user)
            subscription = _activate_subscription_from_checkout(
                user_subscription=subscription,
                transaction_obj=transaction_obj,
                session=stripe_session,
            )

        return Response(
            {
                "detail": "Payment verified and subscription activated.",
                "transaction": _serialize_checkout_transaction(transaction_obj),
                "subscription": UserSubscriptionSerializer(subscription).data,
            },
            status=status.HTTP_200_OK,
        )
