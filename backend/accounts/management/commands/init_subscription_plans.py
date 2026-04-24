from django.core.management.base import BaseCommand
from accounts.subscription_utils import PLAN_DEFAULTS
from accounts.models import SubscriptionPlan


class Command(BaseCommand):
    help = "Initialize default FREE/PRO/PLUS subscription plans"

    def handle(self, *args, **options):
        """Create/update default plans using the centralized defaults map."""
        created_count = 0
        updated_count = 0
        for plan_name, defaults in PLAN_DEFAULTS.items():
            plan, created = SubscriptionPlan.objects.update_or_create(
                name=plan_name,
                defaults=defaults,
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f"✓ Created {plan.display_name} plan")
                )
            else:
                updated_count += 1
                self.stdout.write(f"→ Updated {plan.display_name} plan")
        
        self.stdout.write(
            self.style.SUCCESS(
                f"\n✓ Done! {created_count} created, {updated_count} updated."
            )
        )
