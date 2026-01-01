from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from django.core import mail
from django.contrib.auth import get_user_model
from django.urls import reverse
import re

User = get_user_model()

class AccountsAuthTests(APITestCase):
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
