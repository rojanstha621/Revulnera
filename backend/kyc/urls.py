from django.urls import path

from .views import KYCStatusView, KYCSubmitView


urlpatterns = [
    path("submit/", KYCSubmitView.as_view(), name="kyc-submit"),
    path("status/", KYCStatusView.as_view(), name="kyc-status"),
]
