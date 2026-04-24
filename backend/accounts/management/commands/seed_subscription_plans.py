from django.core.management.base import BaseCommand

from accounts.models import SubscriptionPlan
from accounts.subscription_utils import PLAN_DEFAULTS


class Command(BaseCommand):
    help = "Seed FREE/PRO/PLUS subscription plans"

    def handle(self, *args, **options):
        created = 0
        updated = 0

        for plan_name, defaults in PLAN_DEFAULTS.items():
            _, was_created = SubscriptionPlan.objects.update_or_create(
                name=plan_name,
                defaults=defaults,
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(f"Seed complete. created={created}, updated={updated}"))
