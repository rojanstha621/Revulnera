Vulnerable Test Site for Revulnera

This small Flask app intentionally includes insecure endpoints for testing Revulnera's detection modules.

Warning: Run only in an isolated test environment (local machine or isolated VM). Never expose this to the public internet.

Quick start (local):

```bash
cd vulnerable_site
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Or build with Docker:

```bash
docker build -t revulnera-vulnsite .
docker run --rm -p 8080:80 revulnera-vulnsite
```

Accessible endpoints:
- `/` - index
- `/login` - vulnerable login (username enumeration)
- `/register` - weak registration
- `/vuln_sql?q=foo` - SQL-injection vulnerable query
- `/template_render?input={{7*7}}` - Jinja2 template rendering
- `/.env` and `/.git/config` - intentionally exposed files
- `/admin/` - unprotected admin panel

Use this only for local testing and development of the Revulnera scanner and detection engines.
