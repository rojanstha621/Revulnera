#!/usr/bin/env python
"""
Test script to verify vulnerability detection setup
Run from backend directory: python test_vuln_setup.py
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'revulnera_project.settings')
django.setup()

from vulnscan.models import VulnerabilityFinding
from reconscan.models import Scan

def test_setup():
    print("=" * 60)
    print("VULNERABILITY DETECTION SETUP TEST")
    print("=" * 60)
    
    # Check if vulnscan app is installed
    print("\n1. Checking if vulnscan app is installed...")
    try:
        from django.apps import apps
        if apps.is_installed('vulnscan'):
            print("   ✓ vulnscan app is installed")
        else:
            print("   ✗ vulnscan app is NOT installed")
            return
    except Exception as e:
        print(f"   ✗ Error checking app: {e}")
        return
    
    # Check if table exists
    print("\n2. Checking if vulnerability_findings table exists...")
    try:
        count = VulnerabilityFinding.objects.count()
        print(f"   ✓ Table exists with {count} vulnerability findings")
    except Exception as e:
        print(f"   ✗ Table does not exist or error: {e}")
        print("   Run: python manage.py migrate vulnscan")
        return
    
    # Check if any scans exist
    print("\n3. Checking for existing scans...")
    scan_count = Scan.objects.count()
    print(f"   Found {scan_count} scans")
    
    if scan_count > 0:
        print("\n4. Checking vulnerability findings per scan...")
        for scan in Scan.objects.all()[:5]:
            vuln_count = scan.vulnerability_findings.count()
            print(f"   Scan #{scan.id} ({scan.target}): {vuln_count} vulnerabilities")
    
    # Check URL configuration
    print("\n5. Checking URL configuration...")
    try:
        from django.urls import resolve
        match = resolve('/api/vuln/scans/1/vulnerabilities/ingest/')
        print(f"   ✓ Vulnerability ingestion URL is configured")
        print(f"   View: {match.func.__name__}")
    except Exception as e:
        print(f"   ✗ URL not configured: {e}")
    
    print("\n" + "=" * 60)
    print("SETUP CHECK COMPLETE")
    print("=" * 60)
    
    if scan_count == 0:
        print("\nNOTE: No scans found. Run a scan to test vulnerability detection.")
    
if __name__ == "__main__":
    test_setup()
