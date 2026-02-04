from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("reconscan", "0003_rename_reconscan_d_scan_id_a7f3e5_idx_reconscan_d_scan_id_40d871_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="VulnerabilityFinding",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("host", models.CharField(db_index=True, max_length=255)),
                ("url", models.URLField(max_length=1000)),
                (
                    "owasp_category",
                    models.CharField(
                        choices=[("A01", "Broken Access Control"), ("A02", "Cryptographic Failures")],
                        db_index=True,
                        max_length=3,
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                (
                    "severity",
                    models.CharField(
                        choices=[("Low", "Low"), ("Medium", "Medium"), ("High", "High")],
                        max_length=10,
                    ),
                ),
                (
                    "confidence",
                    models.CharField(
                        choices=[("Low", "Low"), ("Medium", "Medium"), ("High", "High")],
                        max_length=10,
                    ),
                ),
                ("evidence", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "scan",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="vulnerability_findings",
                        to="reconscan.scan",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["scan", "host"], name="vulnscan_vu_scan_id_5b1a7d_idx"),
                    models.Index(fields=["owasp_category"], name="vulnscan_vu_owasp_c_85b3a0_idx"),
                    models.Index(fields=["created_at"], name="vulnscan_vu_created_0a6e5f_idx"),
                ],
            },
        ),
    ]
