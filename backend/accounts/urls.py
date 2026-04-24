# accounts/urls.py
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, ProfileView, ChangePasswordView, VerifyEmailView,
    CustomTokenObtainPairView, LogoutView, ResendVerificationView, ValidateResetTokenView,
    SubscriptionPlanListView, MySubscriptionView, UpgradeSubscriptionView,
)

urlpatterns = [
    # Account onboarding and authentication
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", CustomTokenObtainPairView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("resend-verify/", ResendVerificationView.as_view(), name="resend-verify"),
    path("verify/", VerifyEmailView.as_view(), name="verify"),

    # JWT refresh endpoint
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # Password reset flow from django-rest-passwordreset
    path("password-reset/", include("django_rest_passwordreset.urls", namespace="password_reset")),
    path("password-reset/validate/", ValidateResetTokenView.as_view(), name='password_reset_validate'),

    # Authenticated user self-service endpoints
    path("me/", ProfileView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),

    # Subscription endpoints
    path("subscription/plans/", SubscriptionPlanListView.as_view(), name="subscription-plans"),
    path("subscription/me/", MySubscriptionView.as_view(), name="my-subscription"),
    path("subscription/upgrade/", UpgradeSubscriptionView.as_view(), name="upgrade-subscription"),
]
