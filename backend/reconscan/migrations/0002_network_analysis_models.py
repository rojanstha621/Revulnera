# Generated manually for network analysis subsystem
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reconscan', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PortScanFinding',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('host', models.CharField(db_index=True, max_length=255)),
                ('port', models.IntegerField()),
                ('protocol', models.CharField(default='tcp', max_length=10)),
                ('state', models.CharField(default='open', max_length=20)),
                ('service', models.CharField(blank=True, max_length=100)),
                ('product', models.CharField(blank=True, max_length=255)),
                ('version', models.CharField(blank=True, max_length=100)),
                ('banner', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('scan', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='port_findings', to='reconscan.scan')),
            ],
            options={
                'unique_together': {('scan', 'host', 'port', 'protocol')},
            },
        ),
        migrations.CreateModel(
            name='TLSScanResult',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('host', models.CharField(db_index=True, max_length=255)),
                ('has_https', models.BooleanField(default=False)),
                ('supported_versions', models.JSONField(default=list)),
                ('weak_versions', models.JSONField(default=list)),
                ('cert_valid', models.BooleanField(blank=True, null=True)),
                ('cert_expires_at', models.DateTimeField(blank=True, null=True)),
                ('cert_issuer', models.TextField(blank=True)),
                ('issues', models.JSONField(default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('scan', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tls_results', to='reconscan.scan')),
            ],
            options={
                'unique_together': {('scan', 'host')},
            },
        ),
        migrations.CreateModel(
            name='DirectoryFinding',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('host', models.CharField(db_index=True, max_length=255)),
                ('base_url', models.CharField(max_length=500)),
                ('path', models.CharField(max_length=500)),
                ('status_code', models.IntegerField()),
                ('issue_type', models.CharField(max_length=100)),
                ('evidence', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('scan', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='directory_findings', to='reconscan.scan')),
            ],
            options={
                'unique_together': {('scan', 'host', 'path')},
            },
        ),
        migrations.AddIndex(
            model_name='portscanfinding',
            index=models.Index(fields=['scan', 'host'], name='reconscan_p_scan_id_b6e8f9_idx'),
        ),
        migrations.AddIndex(
            model_name='portscanfinding',
            index=models.Index(fields=['created_at'], name='reconscan_p_created_3b6c4f_idx'),
        ),
        migrations.AddIndex(
            model_name='directoryfinding',
            index=models.Index(fields=['scan', 'host'], name='reconscan_d_scan_id_a7f3e5_idx'),
        ),
        migrations.AddIndex(
            model_name='directoryfinding',
            index=models.Index(fields=['issue_type'], name='reconscan_d_issue_t_5c8d2a_idx'),
        ),
        migrations.AddIndex(
            model_name='directoryfinding',
            index=models.Index(fields=['created_at'], name='reconscan_d_created_4a9b6c_idx'),
        ),
    ]
