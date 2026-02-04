#!/bin/bash
# Quick start script for Network Analysis subsystem

set -e

echo "===================================="
echo "Network Analysis Subsystem Setup"
echo "===================================="

# Navigate to backend directory
cd "$(dirname "$0")/../backend"

echo ""
echo "1. Activating virtual environment..."
if [ -f "env/bin/activate" ]; then
    source env/bin/activate
else
    echo "Warning: Virtual environment not found at env/bin/activate"
    echo "Continuing with system Python..."
fi

echo ""
echo "2. Running migrations..."
python manage.py migrate reconscan

echo ""
echo "3. Checking if Nmap is installed (required for port scanning)..."
if command -v nmap &> /dev/null; then
    echo "✓ Nmap is installed: $(nmap --version | head -n1)"
else
    echo "✗ Nmap is NOT installed!"
    echo "  Install with: sudo apt-get install nmap"
    echo "  Or: sudo yum install nmap"
fi

echo ""
echo "===================================="
echo "Setup Complete!"
echo "===================================="
echo ""
echo "Next steps:"
echo "1. Start Django backend: python manage.py runserver"
echo "2. Start Go worker: cd ../scanner && go run ."
echo "3. Create a scan via API or Django admin"
echo "4. Monitor results in Django admin at:"
echo "   - /admin/reconscan/portscanfinding/"
echo "   - /admin/reconscan/tlsscanresult/"
echo "   - /admin/reconscan/directoryfinding/"
echo ""
echo "For testing individual components:"
echo "  Port scan: cd ../scanner && go test ./network -v"
echo "  Full test: See docs/NETWORK_ANALYSIS_IMPLEMENTATION.md"
echo ""
