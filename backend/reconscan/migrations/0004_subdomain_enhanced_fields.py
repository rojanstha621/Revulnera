from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reconscan', '0003_rename_reconscan_d_scan_id_a7f3e5_idx_reconscan_d_scan_id_40d871_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='subdomain',
            name='ips',
            field=models.JSONField(blank=True, null=False, default=list),
        ),
        migrations.AddField(
            model_name='subdomain',
            name='error_msg',
            field=models.TextField(blank=True, null=False, default=''),
        ),
    ]
