# accounts/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import UserProfile, SubscriptionPlan, UserSubscription

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for optional profile metadata."""

    class Meta:
        model = UserProfile
        fields = ["phone", "address", "profile_image", "updated_at"]
        read_only_fields = ["updated_at"]

class UserSerializer(serializers.ModelSerializer):
    """Read/update serializer for the authenticated user's account data."""

    profile = UserProfileSerializer(required=False)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "is_active", "is_staff", "can_run_vulnerability_scans", "date_joined", "profile"]
        read_only_fields = ["id", "email", "role", "is_active", "is_staff", "can_run_vulnerability_scans", "date_joined"]

    def update(self, instance, validated_data):
        """Update core user fields and nested profile in one request."""
        profile_data = validated_data.pop("profile", None)

        # update user basic fields
        instance.full_name = validated_data.get("full_name", instance.full_name)
        instance.save()

        # update profile
        if profile_data is not None:
            profile, _ = UserProfile.objects.get_or_create(user=instance)
            for k, v in profile_data.items():
                setattr(profile, k, v)
            profile.save()

        return instance

class RegisterSerializer(serializers.ModelSerializer):
    """Used by registration endpoint to create a new user account."""

    password = serializers.CharField(write_only=True, min_length=8)
    class Meta:
        model = User
        fields = ["email", "password", "full_name"]

    def create(self, validated_data):
        """Create user via custom manager so password is hashed correctly."""
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data.get("full_name", "")
        )

class ChangePasswordSerializer(serializers.Serializer):
    """Validates old password and updates to a new password."""

    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        """Prevent password change if current password is incorrect."""
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect")
        return value

    def save(self, **kwargs):
        """Set new password and store audit timestamp."""
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.last_password_change = timezone.now()
        user.save(update_fields=["password", "last_password_change"])
        return user


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """Public serializer for listing subscription plans."""

    price_per_month_display = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "name",
            "display_name",
            "description",
            "price_per_month",
            "price_per_month_display",
            "max_scans_per_month",
            "max_concurrent_scans",
            "max_storage_gb",
            "api_rate_limit_per_minute",
            "support_level",
            "advanced_reporting",
            "custom_integrations",
            "dedicated_account_manager",
            "worker_count",
            "scan_queue_priority",
            "max_scan_history",
            "basic_modules_only",
            "full_owasp_top10",
            "full_export",
            "unlimited_history",
            "api_access",
            "is_active",
        ]

    def get_price_per_month_display(self, obj):
        return f"${obj.price_per_month / 100:.2f}"


class UserSubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for authenticated user's current subscription."""

    plan = SubscriptionPlanSerializer(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserSubscription
        fields = [
            "id",
            "plan",
            "status",
            "current_period_start",
            "current_period_end",
            "days_remaining",
            "is_active",
            "auto_renew",
            "payment_provider",
            "created_at",
            "updated_at",
        ]


class UpgradeSubscriptionSerializer(serializers.Serializer):
    """Payload validator for subscription upgrades/downgrades."""

    plan_id = serializers.IntegerField(required=False)
    plan_name = serializers.ChoiceField(choices=["free", "pro", "plus"], required=False)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate(self, attrs):
        if not attrs.get("plan_id") and not attrs.get("plan_name"):
            raise serializers.ValidationError("Provide either plan_id or plan_name.")
        return attrs
