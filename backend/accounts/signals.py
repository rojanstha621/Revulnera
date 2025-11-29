# accounts/signals.py
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver

@receiver(user_logged_in)
def update_login_info(sender, user, request, **kwargs):
    ip = request.META.get('REMOTE_ADDR')
    user.last_login_ip = ip
    user.save(update_fields=['last_login_ip'])
