# accounts/urls.py
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, ProfileView, ChangePasswordView, VerifyEmailView,
    CustomTokenObtainPairView, LogoutView, ResendVerificationView, ValidateResetTokenView
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", CustomTokenObtainPairView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("resend-verify/", ResendVerificationView.as_view(), name="resend-verify"),
    path("verify/", VerifyEmailView.as_view(), name="verify"),

    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # password reset (already installed)
    path("password-reset/", include("django_rest_passwordreset.urls", namespace="password_reset")),
    path("password-reset/validate/", ValidateResetTokenView.as_view(), name='password_reset_validate'),

    path("me/", ProfileView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
]
