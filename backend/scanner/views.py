import requests
from rest_framework.response import Response
from rest_framework.decorators import api_view

SCANNER_URL = "http://localhost:8090"

@api_view(["POST"])
def scan_subdomains(request):
    domain = request.data.get("domain")
    if not domain:
        return Response({"error": "domain required"}, status=400)

    r = requests.get(f"{SCANNER_URL}/scan/subdomains", params={"domain": domain})

    return Response(r.json(), status=r.status_code)
