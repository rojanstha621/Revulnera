# Auto-Login Authentication Module

## Overview

The auto-login authentication module enables vulnerability scanners to automatically login to target applications and extract authentication credentials. This eliminates the need to manually copy tokens or session cookies for authenticated testing.

## Supported Authentication Types

### 1. JWT Token Authentication

Automatically extracts Bearer tokens from JSON responses.

**Example:**

```python
POST /api/login
{
  "email": "admin@test.com",
  "password": "password123"
}

Response:
{
  "authentication": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Configuration:**
- `auth_type`: `"jwt"`
- `token_json_path`: `"authentication.token"`
- `auth_header_name`: `"Authorization"` (default)

**Result:**
```python
headers = {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Session Cookie Authentication

Automatically extracts session cookies from HTTP responses.

**Example:**

```python
POST /api/login
{
  "email": "user@test.com",
  "password": "secretpass"
}

Response headers:
Set-Cookie: sessionid=abc123; HttpOnly
Set-Cookie: csrftoken=xyz789
```

**Configuration:**
- `auth_type`: `"cookie"`

**Result:**
```python
cookies = {
    "sessionid": "abc123",
    "csrftoken": "xyz789"
}
```

### 3. API Key Authentication

Extracts API keys from JSON responses.

**Example:**

```python
POST /api/authenticate
{
  "username": "apiuser",
  "password": "apipass"
}

Response:
{
  "data": {
    "api_key": "sk_live_123456789"
  }
}
```

**Configuration:**
- `auth_type`: `"api_key"`
- `token_json_path`: `"data.api_key"`
- `auth_header_name`: `"X-API-Key"`

**Result:**
```python
headers = {
    "X-API-Key": "sk_live_123456789"
}
```

## Usage

### Via Django Admin / API

When creating a vulnerability scan, configure the auto-login fields:

```json
{
  "recon_scan": 1,
  "vulnerability_type": "A01_BAC",
  "auth_type": "jwt",
  "login_url": "https://target.com/api/login",
  "username": "admin@test.com",
  "password": "testpass123",
  "token_json_path": "authentication.token",
  "auth_header_name": "Authorization"
}
```

### Programmatic Usage

```python
from vulnerability_detection.login_handler import LoginHandler

# Create handler
handler = LoginHandler(
    login_url="https://api.example.com/login",
    username="admin@test.com",
    password="password123",
    auth_type="jwt",
    token_json_path="auth.token",
    auth_header_name="Authorization",
    timeout=10
)

# Perform login
headers, cookies = handler.login()

# Use in requests
import requests
response = requests.get(
    "https://api.example.com/admin/users",
    headers=headers,
    cookies=cookies
)
```

### Integration with Vulnerability Engines

The auto-login is automatically triggered when the scan engine initializes:

```python
# In BrokenAccessControlEngine.__init__()
if self._should_perform_auto_login():
    self._perform_auto_login()

# Credentials are automatically loaded into self.session
# All subsequent requests include authentication
response = self.session.get(url)  # Auto-authenticated!
```

## JSON Path Syntax

The `token_json_path` field supports dot-notation for nested JSON:

| JSON Structure | Path | Extracted Value |
|----------------|------|-----------------|
| `{"token": "abc"}` | `"token"` | `"abc"` |
| `{"auth": {"token": "abc"}}` | `"auth.token"` | `"abc"` |
| `{"data": {"user": {"apiKey": "abc"}}}` | `"data.user.apiKey"` | `"abc"` |

## Error Handling

The module handles various error scenarios:

1. **Network Timeout**: Returns `(None, None)` if login request times out
2. **Invalid JSON**: Gracefully handles malformed JSON responses
3. **Missing Token**: Returns `(None, None)` if token path doesn't exist
4. **HTTP Errors**: Logs error but attempts credential extraction anyway

## Security Considerations

⚠️ **Important Security Notes:**

1. **Passwords are stored in plaintext** in the database
   - Only use test credentials
   - Never use production credentials
   - Consider using environment variables or secrets management

2. **Logging**
   - Passwords are NOT logged
   - Token values are logged (first 20 chars only)
   - Cookie names are logged, but not values

3. **Best Practices**
   - Use dedicated test accounts with limited permissions
   - Rotate credentials regularly
   - Monitor for unusual authentication patterns

## Testing

Run the test suite:

```bash
python manage.py test vulnerability_detection.test_login_handler
```

Test cases cover:
- JWT token extraction
- Session cookie extraction
- API key extraction
- Timeout handling
- Invalid JSON handling
- Nested value extraction
- Multi-handler fallback

## Advanced: Multi-Auth Handler

For applications with multiple login endpoints:

```python
from vulnerability_detection.login_handler import MultiAuthHandler, LoginHandler

# Create multiple handlers
handler1 = LoginHandler(
    login_url="https://api.example.com/auth/login",
    username="user@test.com",
    password="pass123",
    auth_type="jwt",
    token_json_path="token"
)

handler2 = LoginHandler(
    login_url="https://api.example.com/v2/authenticate",
    username="user@test.com",
    password="pass123",
    auth_type="jwt",
    token_json_path="authentication.accessToken"
)

# Try handlers in sequence
multi = MultiAuthHandler([handler1, handler2])
headers, cookies = multi.login()  # Uses first successful handler
```

## Logging

Enable debug logging to troubleshoot authentication issues:

```python
import logging
logging.getLogger('vulnerability_detection.login_handler').setLevel(logging.DEBUG)
```

Sample log output:
```
INFO - LoginHandler initialized for https://api.example.com/login with auth_type=jwt
INFO - Attempting login to https://api.example.com/login as user admin@test.com
INFO - Login successful (status 200)
INFO - Successfully extracted JWT token (length: 245)
DEBUG - Token preview: eyJhbGciOiJIUzI1NiIs...
INFO - Auto-login successful: extracted 1 headers
```

## Database Schema

New fields added to `VulnerabilityScan` model:

| Field | Type | Description |
|-------|------|-------------|
| `auth_type` | CharField | Authentication type (jwt/cookie/api_key/none) |
| `login_url` | CharField | Login endpoint URL |
| `username` | CharField | Username or email |
| `password` | CharField | Password (plaintext) |
| `token_json_path` | CharField | Dot-notation path to extract token |
| `auth_header_name` | CharField | Header name (default: Authorization) |

## API Examples

### Create Scan with Auto-Login (JWT)

```bash
POST /api/vulnerability-detection/scans/
{
  "recon_scan": 1,
  "vulnerability_type": "A01_BAC",
  "auth_type": "jwt",
  "login_url": "https://target.com/api/auth/login",
  "username": "test@example.com",
  "password": "testpass123",
  "token_json_path": "authentication.token"
}
```

### Create Scan with Auto-Login (Cookie)

```bash
POST /api/vulnerability-detection/scans/
{
  "recon_scan": 1,
  "vulnerability_type": "A01_BAC",
  "auth_type": "cookie",
  "login_url": "https://target.com/login",
  "username": "admin",
  "password": "admin123"
}
```

### Manual Authentication (No Auto-Login)

```bash
POST /api/vulnerability-detection/scans/
{
  "recon_scan": 1,
  "vulnerability_type": "A01_BAC",
  "auth_type": "none",
  "auth_headers": {
    "Authorization": "Bearer manually_provided_token"
  },
  "auth_cookies": {
    "sessionid": "manually_provided_cookie"
  }
}
```

## Troubleshooting

### Login fails with timeout

- Increase timeout: `handler = LoginHandler(..., timeout=30)`
- Check network connectivity
- Verify login URL is accessible

### Token not extracted

- Verify `token_json_path` matches response structure
- Check JSON response format: `print(response.json())`
- Enable debug logging to see response content

### Authentication not working in tests

- Verify extracted credentials are valid
- Check if target requires additional headers (User-Agent, etc.)
- Test credentials manually with curl/Postman first

## Future Enhancements

Potential improvements for future versions:

1. **OAuth2 Support** - Authorization code flow, client credentials
2. **SAML Authentication** - Enterprise SSO support
3. **Multi-Factor Authentication** - OTP, SMS codes
4. **Credential Encryption** - Encrypt passwords at rest
5. **Session Management** - Auto-refresh expired tokens
6. **Browser Automation** - Selenium/Playwright for complex login flows

## Support

For issues or questions:
- Check logs: `backend/runserver.log`
- Enable debug logging
- Review test cases for examples
- Check this documentation

---

**Created:** March 6, 2026  
**Version:** 1.0  
**Module:** `vulnerability_detection.login_handler`
