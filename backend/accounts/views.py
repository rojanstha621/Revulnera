# accounts/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .serializers import RegisterSerializer, UserSerializer, ChangePasswordSerializer
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.urls import reverse
from django.conf import settings
from rest_framework.views import APIView

User = get_user_model()
token_generator = PasswordResetTokenGenerator()

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        user = serializer.save()
        # send verification email
        token = token_generator.make_token(user)
        verify_url = f"http://localhost:8000/auth/verify?email={user.email}&token={token}"
        # dev: console backend prints; prod: configure SMTP
        send_mail(
            "Verify your Revulnera account",
            f"Click to verify your account: {verify_url}",
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )

from django.core.signing import BadSignature, SignatureExpired, dumps, loads
 
class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        email = request.GET.get("email")
        token = request.GET.get("token")

        if not email or not token:
            return Response({"detail": "Missing parameters"}, status=400)

        User = get_user_model()
        user = User.objects.filter(email=email).first()
        if not user:
            return Response({"detail": "User not found"}, status=404)

        # check token using PasswordResetTokenGenerator
        if not token_generator.check_token(user, token):
            return Response({"detail": "Invalid or expired token"}, status=400)

        # activate user
        user.is_active = True
        user.save()

        return Response({"detail": "Email verified successfully. You can now log in."})


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
        serializer = self.get_serializer(data=request.data, context={'request':request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail':'Password updated successfully'})
