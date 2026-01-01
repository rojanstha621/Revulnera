# accounts/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import RegisterSerializer, UserSerializer, ChangePasswordSerializer
from .utils import make_verify_token, verify_token

User = get_user_model()

def api_error(message, code=status.HTTP_400_BAD_REQUEST, field=None):
    # Consistent error structure for frontend
    payload = {"detail": message}
    if field:
        payload["field"] = field
    return Response(payload, status=code)

def send_verification_email(request, user):
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
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        # If a user with this email already exists, handle accordingly
        email = request.data.get("email")
        if email:
            existing = User.objects.filter(email=email).first()
            if existing:
                if existing.is_active:
                    return api_error("Email already registered", code=status.HTTP_400_BAD_REQUEST)
                # existing but not active -> resend verification and return a successful message
                send_verification_email(request, existing)
                return Response({"detail": "Account exists but not verified. Verification email resent."}, status=status.HTTP_200_OK)

        # Default: create new user and send verification
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = serializer.save()
        send_verification_email(self.request, user)

class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.GET.get("token")
        if not token:
            return api_error("token is required", field="token")

        email, err = verify_token(token, max_age_seconds=60 * 60 * 24)  # 24 hours
        if err:
            return api_error(err, code=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email).first()
        if not user:
            return api_error("User not found", code=status.HTTP_404_NOT_FOUND)

        if user.is_active:
            return Response({"detail": "Account already verified"}, status=status.HTTP_200_OK)

        user.is_active = True
        user.save(update_fields=["is_active"])
        return Response({"detail": "Email verified successfully. You can now log in."})

class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return api_error("email is required", field="email")

        user = User.objects.filter(email=email).first()
        if not user:
            return api_error("User not found", code=status.HTTP_404_NOT_FOUND)

        if user.is_active:
            return api_error("Account already verified", code=status.HTTP_400_BAD_REQUEST)

        send_verification_email(request, user)
        return Response({"detail": "Verification email sent"})


class ValidateResetTokenView(APIView):
    """Validate password reset token (dev-friendly)"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.GET.get("token")
        if not token:
            return api_error("token is required", field="token")

        from django_rest_passwordreset.models import ResetPasswordToken

        exists = ResetPasswordToken.objects.filter(key=token).exists()
        if not exists:
            return api_error("Invalid or expired token", code=status.HTTP_400_BAD_REQUEST)

        return Response({"ok": True})

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return api_error("refresh token required", field="refresh")

        try:
            token = RefreshToken(refresh)
            token.blacklist()
            return Response({"detail": "Logged out"})
        except Exception:
            return api_error("Invalid refresh token", code=status.HTTP_400_BAD_REQUEST)

class CustomTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            return api_error("Invalid credentials", code=status.HTTP_401_UNAUTHORIZED)

        user = getattr(serializer, "user", None)
        if user and not user.is_active:
            return api_error("Account not verified", code=status.HTTP_401_UNAUTHORIZED)

        # update IP
        if user:
            ip = request.META.get("REMOTE_ADDR")
            user.last_login_ip = ip
            user.save(update_fields=["last_login_ip"])

        return Response(serializer.validated_data, status=status.HTTP_200_OK)

class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

class ChangePasswordView(generics.UpdateAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password updated successfully"})
