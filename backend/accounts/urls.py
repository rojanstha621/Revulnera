# accounts/urls.py
from django.urls import path, include
from .views import RegisterView, ProfileView, ChangePasswordView, VerifyEmailView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenBlacklistView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/blacklist/', TokenBlacklistView.as_view(), name='token_blacklist'),
    path('me/', ProfileView.as_view(), name='me'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),

    # email verification + password reset using django_rest_passwordreset
    path('verify-email/<str:token>/', VerifyEmailView.as_view(), name='verify-email'),
    path('password-reset/', include('django_rest_passwordreset.urls', namespace='password_reset')),
]
