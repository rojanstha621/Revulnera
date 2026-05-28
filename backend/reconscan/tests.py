from django.test import TestCase

from .serializers import ScanSerializer


class ScanSerializerTests(TestCase):
	def test_validate_target_preserves_url_path(self):
		serializer = ScanSerializer(data={"target": "http://192.168.1.167/dvwa/"})

		self.assertTrue(serializer.is_valid(), serializer.errors)
		self.assertEqual(serializer.validated_data["target"], "http://192.168.1.167/dvwa/")

	def test_validate_target_keeps_hostname_for_bare_host(self):
		serializer = ScanSerializer(data={"target": "192.168.1.167"})

		self.assertTrue(serializer.is_valid(), serializer.errors)
		self.assertEqual(serializer.validated_data["target"], "192.168.1.167")
