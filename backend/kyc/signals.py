from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import KYCSubmission

User = get_user_model()


@receiver(post_save, sender=KYCSubmission)
def notify_admins_on_kyc_submission(sender, instance, created, **kwargs):
    if not created:
        return

    admins = User.objects.filter(is_active=True).filter(is_staff=True) | User.objects.filter(
        is_active=True,
        role="admin",
    )
    recipient_list = list(admins.values_list("email", flat=True).distinct())

    if not recipient_list:
        return

    send_mail(
        subject="New KYC Submission Pending Review",
        message=(
            f"User: {instance.user.email}\n"
            f"Document type: {instance.doc_type}\n"
            "Review queue: /api/recon/admin/kyc-queue/"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=recipient_list,
        fail_silently=False,
    )
