"""
Django settings for revulnera_project project.
"""

import json
import os
from pathlib import Path
from datetime import timedelta

# --------------------------------------------------
# Base directory
# --------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# --------------------------------------------------
# Security
# --------------------------------------------------
SECRET_KEY = 'django-insecure-9o9a4&d0g2+zfl0&pg-lg_k@ubbfq_e$1^7%rg9-qe6nm_@f@g'
DEBUG = True

# FIX: required for proper URL generation & dev stability
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# --------------------------------------------------
# Applications
# --------------------------------------------------
INSTALLED_APPS = [
    "daphne",

    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "corsheaders",

    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_extensions",

    "accounts",
    "django_rest_passwordreset",
    "channels",
    "monitoring.apps.MonitoringConfig",
    "reconscan",
    "kyc.apps.KycConfig",
    "vulnerability_detection",
]

# --------------------------------------------------
# ASGI / Channels
# --------------------------------------------------
ASGI_APPLICATION = "revulnera_project.asgi.application"

CHANNEL_REDIS_URL = os.getenv(
    "CHANNEL_REDIS_URL",
    os.getenv("CELERY_BROKER_URL", "redis://127.0.0.1:6379/0"),
)
if CHANNEL_REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [CHANNEL_REDIS_URL],
            },
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer"
        }
    }

# --------------------------------------------------
# External services
# --------------------------------------------------
GO_RECON_URL = "http://localhost:8080"

# Celery broker/backend (required for async vulnerability scan execution).
# By default we target local Redis for development.
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://127.0.0.1:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", CELERY_BROKER_URL)
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True

# --------------------------------------------------
# Custom user model
# --------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

# --------------------------------------------------
# Middleware
# --------------------------------------------------
# FIX: CORS middleware MUST be at the top
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# --------------------------------------------------
# CORS (dev)
# --------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = True

# --------------------------------------------------
# URLs / Templates
# --------------------------------------------------
ROOT_URLCONF = "revulnera_project.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "revulnera_project.wsgi.application"

# --------------------------------------------------
# Authentication
# --------------------------------------------------
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
]

# --------------------------------------------------
# REST Framework + JWT
# --------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_CLASSES": (),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=3),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# --------------------------------------------------
# Database (PostgreSQL)
# --------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "revulnera_db",
        "USER": "revuser",
        "PASSWORD": "revpass123",
        "HOST": "localhost",
        "PORT": "5432",
    }
}

# --------------------------------------------------
# Password validation
# --------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --------------------------------------------------
# Internationalization
# --------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# --------------------------------------------------
# Static files
# --------------------------------------------------
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Private KYC upload storage (not exposed via public media URL)
KYC_PRIVATE_FILES_ROOT = BASE_DIR / "private_kyc_uploads"

# --------------------------------------------------
# Email (DEV MODE)
# --------------------------------------------------
# IMPORTANT:
# Emails are PRINTED in terminal, not sent.
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True

EMAIL_HOST_USER = "rojanstha621@gmail.com"
EMAIL_HOST_PASSWORD = "qfwa mvpq aheh mqoi"

DEFAULT_FROM_EMAIL = EMAIL_HOST_USER


# --------------------------------------------------
# Frontend URL (used for links if needed)
# --------------------------------------------------
DEFAULT_FRONTEND_URL = "http://localhost:5173"

# Optional auto-sync feed catalog for bug bounty scopes.
# Example:
# export BUG_BOUNTY_AUTO_FEEDS='[
#   {"platform":"hackerone","program_name":"example-program","source_url":"https://.../scopes.json"}
# ]'
BUG_BOUNTY_AUTO_FEEDS = []
_auto_feed_raw = os.getenv("BUG_BOUNTY_AUTO_FEEDS", "").strip()
if _auto_feed_raw:
    try:
        parsed = json.loads(_auto_feed_raw)
        if isinstance(parsed, list):
            BUG_BOUNTY_AUTO_FEEDS = parsed
    except json.JSONDecodeError:
        BUG_BOUNTY_AUTO_FEEDS = []

# --------------------------------------------------
# Extra security (safe even in dev)
# --------------------------------------------------
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
