from django.conf import settings
from django.db import models

from .storage import kyc_private_storage


class KYCSubmission(models.Model):
    DOC_TYPE_PASSPORT = "PASSPORT"
    DOC_TYPE_CITIZENSHIP = "CITIZENSHIP"
    DOC_TYPE_LICENSE = "LICENSE"

    DOC_TYPE_CHOICES = (
        (DOC_TYPE_PASSPORT, "Passport"),
        (DOC_TYPE_CITIZENSHIP, "Citizenship"),
        (DOC_TYPE_LICENSE, "License"),
    )

    STATUS_PENDING = "PENDING"
    STATUS_APPROVED = "APPROVED"
    STATUS_REJECTED = "REJECTED"

    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="kyc_submissions",
    )
    doc_type = models.CharField(max_length=20, choices=DOC_TYPE_CHOICES)
    doc_front = models.ImageField(upload_to="kyc/docs/", storage=kyc_private_storage)
    doc_back = models.ImageField(upload_to="kyc/docs/", storage=kyc_private_storage, blank=True, null=True)
    selfie = models.ImageField(upload_to="kyc/selfies/", storage=kyc_private_storage)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
    )
    rejection_reason = models.TextField(blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kyc_reviews",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"KYCSubmission(user={self.user_id}, status={self.status})"
