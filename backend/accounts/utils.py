# accounts/utils.py
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from django.conf import settings

signer = TimestampSigner(salt="revulnera-email-verify")

def make_verify_token(email: str) -> str:
    return signer.sign(email)

def verify_token(token: str, max_age_seconds: int):
    try:
        email = signer.unsign(token, max_age=max_age_seconds)
        return email, None
    except SignatureExpired:
        return None, "Verification link expired"
    except BadSignature:
        return None, "Invalid verification link"
