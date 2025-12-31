# accounts/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import UserProfile

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["phone", "address", "profile_image", "updated_at"]
        read_only_fields = ["updated_at"]

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "is_active", "date_joined", "profile"]
        read_only_fields = ["id", "email", "role", "is_active", "date_joined"]

    def update(self, instance, validated_data):
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
    password = serializers.CharField(write_only=True, min_length=8)
    class Meta:
        model = User
        fields = ["email", "password", "full_name"]

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data.get("full_name", "")
        )

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.last_password_change = timezone.now()
        user.save(update_fields=["password", "last_password_change"])
        return user
