from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage


class KYCPrivateStorage(FileSystemStorage):
    def __init__(self, *args, **kwargs):
        location = kwargs.pop(
            "location",
            getattr(settings, "KYC_PRIVATE_FILES_ROOT", Path(settings.BASE_DIR) / "private_kyc_uploads"),
        )
        super().__init__(location=location, base_url=None, *args, **kwargs)


kyc_private_storage = KYCPrivateStorage()
