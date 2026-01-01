# accounts/signals.py
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from django.conf import settings
from django.core.mail import send_mail
from django_rest_passwordreset.signals import reset_password_token_created

@receiver(user_logged_in)
def update_login_info(sender, user, request, **kwargs):
    ip = request.META.get('REMOTE_ADDR')
    user.last_login_ip = ip
    user.save(update_fields=['last_login_ip'])

@receiver(reset_password_token_created)
def password_reset_token_created(sender, instance, reset_password_token, **kwargs):
    reset_url = (
        f"{settings.DEFAULT_FRONTEND_URL}/auth/reset-password/"
        f"{reset_password_token.key}"
    )

    send_mail(
        subject="Reset your password",
        message=f"Use the link below to reset your password:\n\n{reset_url}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[reset_password_token.user.email],
        fail_silently=False,
    )