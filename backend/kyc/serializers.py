from rest_framework import serializers
from django.urls import reverse

from .models import KYCSubmission


class KYCSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = KYCSubmission
        fields = ["doc_type", "doc_front", "doc_back", "selfie"]

    def validate(self, attrs):
        user = self.context["request"].user
        already_exists = KYCSubmission.objects.filter(
            user=user,
            status__in=[KYCSubmission.STATUS_PENDING, KYCSubmission.STATUS_APPROVED],
        ).exists()
        if already_exists:
            raise serializers.ValidationError(
                "You already have a pending or approved KYC submission."
            )
        return attrs

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        validated_data["status"] = KYCSubmission.STATUS_PENDING
        return super().create(validated_data)


class KYCStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = KYCSubmission
        fields = ["status", "submitted_at", "rejection_reason"]


class KYCQueueItemSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = KYCSubmission
        fields = ["id", "user_email", "doc_type", "submitted_at"]


class KYCDetailSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)
    doc_front = serializers.SerializerMethodField()
    doc_back = serializers.SerializerMethodField()
    selfie = serializers.SerializerMethodField()

    def _build_secure_file_url(self, obj, file_field):
        file_value = getattr(obj, file_field)
        if not file_value:
            return None

        relative_url = reverse(
            "admin-kyc-file",
            kwargs={"submission_id": obj.id, "file_field": file_field},
        )
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(relative_url)
        return relative_url

    def get_doc_front(self, obj):
        return self._build_secure_file_url(obj, "doc_front")

    def get_doc_back(self, obj):
        return self._build_secure_file_url(obj, "doc_back")

    def get_selfie(self, obj):
        return self._build_secure_file_url(obj, "selfie")

    class Meta:
        model = KYCSubmission
        fields = [
            "id",
            "user",
            "user_email",
            "user_full_name",
            "doc_type",
            "doc_front",
            "doc_back",
            "selfie",
            "status",
            "rejection_reason",
            "submitted_at",
            "reviewed_by",
            "reviewed_at",
        ]
        read_only_fields = fields
