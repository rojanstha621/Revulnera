from django.conf import settings
from django.http import FileResponse
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin
from .models import KYCSubmission
from .serializers import (
    KYCDetailSerializer,
    KYCQueueItemSerializer,
    KYCStatusSerializer,
    KYCSubmissionSerializer,
)


class KYCSubmitView(APIView):
    """User submits identity documents for admin review."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = KYCSubmissionSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        submission = serializer.save()
        return Response(
            {
                "detail": "KYC documents submitted successfully.",
                "id": submission.id,
                "status": submission.status,
                "submitted_at": submission.submitted_at,
            },
            status=status.HTTP_201_CREATED,
        )


class KYCStatusView(APIView):
    """User checks latest KYC status from their own submissions."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        submission = (
            KYCSubmission.objects.filter(user=request.user)
            .order_by("-submitted_at")
            .first()
        )

        if not submission:
            return Response(
                {
                    "status": "NOT_SUBMITTED",
                    "submitted_at": None,
                    "rejection_reason": None,
                },
                status=status.HTTP_200_OK,
            )

        payload = KYCStatusSerializer(submission).data
        if submission.status != KYCSubmission.STATUS_REJECTED:
            payload["rejection_reason"] = None
        return Response(payload, status=status.HTTP_200_OK)


class AdminKYCQueueView(APIView):
    """Admin view to list all pending KYC submissions."""

    permission_classes = [IsAdmin]

    def get(self, request):
        queue = KYCSubmission.objects.filter(status=KYCSubmission.STATUS_PENDING).select_related("user")
        serializer = KYCQueueItemSerializer(queue, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminKYCDetailView(APIView):
    """Admin view to inspect one KYC submission in detail."""

    permission_classes = [IsAdmin]

    def get(self, request, submission_id):
        submission = KYCSubmission.objects.select_related("user", "reviewed_by").filter(id=submission_id).first()
        if not submission:
            return Response({"detail": "KYC submission not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = KYCDetailSerializer(submission, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminKYCFileView(APIView):
    """Admin-only endpoint to stream uploaded KYC files securely."""

    permission_classes = [IsAdmin]

    def get(self, request, submission_id, file_field):
        if file_field not in {"doc_front", "doc_back", "selfie"}:
            return Response({"detail": "Invalid file field."}, status=status.HTTP_400_BAD_REQUEST)

        submission = KYCSubmission.objects.filter(id=submission_id).first()
        if not submission:
            return Response({"detail": "KYC submission not found."}, status=status.HTTP_404_NOT_FOUND)

        file_value = getattr(submission, file_field)
        if not file_value:
            return Response({"detail": "File not available."}, status=status.HTTP_404_NOT_FOUND)

        file_value.open("rb")
        return FileResponse(file_value, as_attachment=False)


class AdminKYCApproveView(APIView):
    """Approve KYC and unlock vulnerability scanning for the user."""

    permission_classes = [IsAdmin]

    def post(self, request, submission_id):
        submission = KYCSubmission.objects.select_related("user").filter(id=submission_id).first()
        if not submission:
            return Response({"detail": "KYC submission not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            submission.status = KYCSubmission.STATUS_APPROVED
            submission.rejection_reason = None
            submission.reviewed_by = request.user
            submission.reviewed_at = timezone.now()
            submission.save(update_fields=["status", "rejection_reason", "reviewed_by", "reviewed_at"])

            user = submission.user
            user.can_run_vulnerability_scans = True
            user.save(update_fields=["can_run_vulnerability_scans"])

        send_mail(
            subject="KYC Approved",
            message="Your identity has been verified. Vulnerability detection is now unlocked.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[submission.user.email],
            fail_silently=False,
        )

        return Response({"detail": "KYC submission approved."}, status=status.HTTP_200_OK)


class AdminKYCRejectView(APIView):
    """Reject KYC, store reason, and keep scan access disabled."""

    permission_classes = [IsAdmin]

    def post(self, request, submission_id):
        rejection_reason = request.data.get("rejection_reason")
        if not rejection_reason:
            return Response(
                {"detail": "rejection_reason is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        submission = KYCSubmission.objects.select_related("user").filter(id=submission_id).first()
        if not submission:
            return Response({"detail": "KYC submission not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            submission.status = KYCSubmission.STATUS_REJECTED
            submission.rejection_reason = rejection_reason
            submission.reviewed_by = request.user
            submission.reviewed_at = timezone.now()
            submission.save(update_fields=["status", "rejection_reason", "reviewed_by", "reviewed_at"])

            user = submission.user
            user.can_run_vulnerability_scans = False
            user.save(update_fields=["can_run_vulnerability_scans"])

        send_mail(
            subject="KYC Rejected",
            message=(
                "Your identity verification was rejected. "
                f"Reason: {rejection_reason}\n\n"
                "Please resubmit your documents after addressing the issue."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[submission.user.email],
            fail_silently=False,
        )

        return Response({"detail": "KYC submission rejected."}, status=status.HTTP_200_OK)
