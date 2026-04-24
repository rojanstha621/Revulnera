from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_subscriptionplan_subscriptionhistory_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="subscriptionplan",
            name="api_access",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="subscriptionplan",
            name="basic_modules_only",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="subscriptionplan",
            name="full_export",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="subscriptionplan",
            name="full_owasp_top10",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="subscriptionplan",
            name="max_scan_history",
            field=models.PositiveIntegerField(blank=True, help_text="How many historical scans are retained. null = unlimited", null=True),
        ),
        migrations.AddField(
            model_name="subscriptionplan",
            name="scan_queue_priority",
            field=models.PositiveIntegerField(default=1, help_text="Higher means higher queue priority"),
        ),
        migrations.AddField(
            model_name="subscriptionplan",
            name="unlimited_history",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="subscriptionplan",
            name="worker_count",
            field=models.PositiveIntegerField(default=1, help_text="Worker threads/processes assigned in Go scanner"),
        ),
        migrations.AddField(
            model_name="usersubscription",
            name="payment_provider",
            field=models.CharField(choices=[("manual", "Manual"), ("stripe", "Stripe"), ("razorpay", "Razorpay")], default="manual", max_length=20),
        ),
    ]
