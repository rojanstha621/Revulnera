from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from django.core import mail
from django.contrib.auth import get_user_model
from django.urls import reverse
import re
from unittest.mock import patch

from .models import StripeCheckoutTransaction
from .subscription_utils import get_or_create_user_subscription

User = get_user_model()

class AccountsAuthTests(APITestCase):
    """Integration-style tests for register/login/verify/logout account flows."""

    def test_register_verify_resend_and_login(self):
        client = APIClient()
        email = "alice@example.com"
        password = "superpass123"

        # register
        res = client.post("/auth/register/", {"email": email, "password": password, "full_name": "Alice"}, format='json')
        self.assertEqual(res.status_code, 201)
        user = User.objects.get(email=email)
        self.assertFalse(user.is_active)

        # check verification email sent
        self.assertTrue(len(mail.outbox) >= 1)
        body = mail.outbox[-1].body
        m = re.search(r"token=([\w-]+)", body)
        self.assertIsNotNone(m)
        token = m.group(1)

        # verify
        res = client.get(f"/auth/verify/?email={email}&token={token}")
        self.assertEqual(res.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.is_active)

        # create unverified user to test resend
        email2 = "bob@example.com"
        user2 = User.objects.create_user(email=email2, password="abc12345")
        self.assertFalse(user2.is_active)
        res = client.post("/auth/resend-verify/", {"email": email2}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(len(mail.outbox) >= 2)

    def test_reregister_with_unverified_resends_email(self):
        client = APIClient()
        email = "eve@example.com"
        password = "p@ssw0rd1"

        # initial register
        res = client.post("/auth/register/", {"email": email, "password": password, "full_name": "Eve"}, format='json')
        self.assertEqual(res.status_code, 201)
        user = User.objects.get(email=email)
        self.assertFalse(user.is_active)
        self.assertTrue(len(mail.outbox) >= 1)

        # attempt to register again with same email -> should not error but resend verification
        prev_outbox = len(mail.outbox)
        res = client.post("/auth/register/", {"email": email, "password": password, "full_name": "Eve"}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn("Verification email resent", res.data.get('detail',''))
        self.assertTrue(len(mail.outbox) > prev_outbox)

        # login
        res = client.post("/auth/login/", {"email": email, "password": password}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)

    def test_login_blocks_unverified_and_updates_ip(self):
        client = APIClient()
        email = "carol@example.com"
        password = "passw0rd123"
        user = User.objects.create_user(email=email, password=password)
        self.assertFalse(user.is_active)

        # unverified login should fail
        res = client.post("/auth/login/", {"email": email, "password": password}, format='json')
        self.assertNotEqual(res.status_code, 200)

        # activate user and login
        user.is_active = True
        user.save()
        res = client.post("/auth/login/", {"email": email, "password": password}, format='json')
        self.assertEqual(res.status_code, 200)
        user.refresh_from_db()
        # test that last_login_ip was updated (tests run locally; IP may be 127.0.0.1)
        self.assertIsNotNone(user.last_login_ip)

    def test_logout_blacklists_refresh_token(self):
        client = APIClient()
        email = "dave@example.com"
        password = "Xpass12345"
        user = User.objects.create_user(email=email, password=password)
        user.is_active = True
        user.save()

        res = client.post("/auth/login/", {"email": email, "password": password}, format='json')
        self.assertEqual(res.status_code, 200)
        refresh = res.data.get('refresh')
        self.assertIsNotNone(refresh)

        # logout (blacklist)
        res = client.post("/auth/logout/", {"refresh": refresh}, format='json')
        self.assertEqual(res.status_code, 200)

        # try to refresh with the same token -> should fail
        res = client.post("/auth/token/refresh/", {"refresh": refresh}, format='json')
        self.assertNotEqual(res.status_code, 200)


class StripeSubscriptionFlowTests(APITestCase):
    """Stripe checkout flow should store pending transactions and verify on the backend."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="stripe@example.com", password="testpass123")
        self.user.is_active = True
        self.user.email_verified = True
        self.user.save(update_fields=["is_active", "email_verified"])
        self.client.force_authenticate(user=self.user)
        self.subscription = get_or_create_user_subscription(self.user)

    def test_create_checkout_session_stores_pending_transaction(self):
        plan = self.subscription.plan.__class__.objects.get(name="pro")

        with patch("accounts.views.create_checkout_session") as mock_create_session:
            mock_create_session.return_value = {"id": "cs_test_123"}
            response = self.client.post(
                "/auth/subscription/stripe/create-checkout-session/",
                {"plan_id": plan.id},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["sessionId"], "cs_test_123")
        transaction = StripeCheckoutTransaction.objects.get(stripe_session_id="cs_test_123")
        self.assertEqual(transaction.status, "pending")
        self.assertEqual(transaction.plan_id, plan.id)
        self.assertEqual(transaction.amount, plan.price_per_month)
        self.assertEqual(transaction.user_id, self.user.id)

    def test_verify_checkout_session_activates_once_and_is_idempotent(self):
        plan = self.subscription.plan.__class__.objects.get(name="pro")

        with patch("accounts.views.create_checkout_session") as mock_create_session:
            mock_create_session.return_value = {"id": "cs_test_456"}
            create_response = self.client.post(
                "/auth/subscription/stripe/create-checkout-session/",
                {"plan_id": plan.id},
                format="json",
            )

        self.assertEqual(create_response.status_code, 201)
        transaction = StripeCheckoutTransaction.objects.get(stripe_session_id="cs_test_456")

        stripe_session = {
            "id": "cs_test_456",
            "client_reference_id": str(transaction.id),
            "payment_status": "paid",
            "subscription": "sub_test_789",
            "payment_intent": "pi_test_789",
        }

        with patch("accounts.views.retrieve_checkout_session") as mock_retrieve_session:
            mock_retrieve_session.return_value = stripe_session
            verify_response = self.client.post(
                "/auth/subscription/stripe/verify-session/",
                {"session_id": "cs_test_456"},
                format="json",
            )

        self.assertEqual(verify_response.status_code, 200)
        transaction.refresh_from_db()
        self.assertEqual(transaction.status, "completed")
        self.assertEqual(transaction.stripe_subscription_id, "sub_test_789")
        self.assertEqual(transaction.stripe_payment_status, "paid")

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.plan_id, plan.id)
        self.assertEqual(self.subscription.payment_provider, "stripe")
        self.assertEqual(self.subscription.subscription_id, "sub_test_789")

        with patch("accounts.views.retrieve_checkout_session") as mock_retrieve_session_again:
            retry_response = self.client.post(
                "/auth/subscription/stripe/verify-session/",
                {"session_id": "cs_test_456"},
                format="json",
            )

        self.assertEqual(retry_response.status_code, 200)
        self.assertIn("already processed", retry_response.data["detail"].lower())
        self.assertEqual(StripeCheckoutTransaction.objects.filter(stripe_session_id="cs_test_456").count(), 1)
