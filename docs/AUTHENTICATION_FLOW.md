# Authentication Flow Documentation

## Complete Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. User Creates Recon Scan                   │
│                                                                  │
│  Frontend → POST /api/recon/scans/                             │
│  {                                                              │
│    "target": "https://example.com",                            │
│    "auth_headers": {...},  // Optional                         │
│    "auth_cookies": {...}   // Optional                         │
│  }                                                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              2. User Creates Vulnerability Scan                 │
│                                                                  │
│  Frontend → POST /api/vulnerability-detection/scans/           │
│  {                                                              │
│    "recon_scan": 1,                                            │
│    "vulnerability_type": "A01_BAC",                            │
│    "auth_type": "jwt",           // Auto-login config          │
│    "login_url": "https://example.com/api/login",               │
│    "username": "admin@test.com",                               │
│    "password": "password123",                                  │
│    "token_json_path": "auth.token"                             │
│  }                                                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│         3. VulnerabilityScan.save() - Auto Inheritance          │
│                                                                  │
│  IF auth_headers is empty:                                      │
│    auth_headers = recon_scan.auth_headers                       │
│                                                                  │
│  IF auth_cookies is empty:                                      │
│    auth_cookies = recon_scan.auth_cookies                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│    4. User Executes Vulnerability Scan                          │
│                                                                  │
│  Frontend → POST /api/vulnerability-detection/scans/7/execute/ │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│       5. BrokenAccessControlEngine.__init__()                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐          │
│  │ Check: Should perform auto-login?                 │          │
│  │                                                    │          │
│  │ IF auth_type != "none" AND                        │          │
│  │    login_url exists AND                           │          │
│  │    username exists AND                            │          │
│  │    password exists:                               │          │
│  │      → YES, perform auto-login                    │          │
│  └────────────┬───────────────────────────────────────┘          │
│               │                                                  │
│               ▼                                                  │
│  ┌──────────────────────────────────────────────────┐          │
│  │ Auto-Login Flow                                   │          │
│  └──────────────────────────────────────────────────┘          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                 6. LoginHandler.login()                          │
│                                                                  │
│  ┌─────────────────────────────────────────────┐               │
│  │ Step 1: Perform Login Request                │               │
│  │                                               │               │
│  │ POST {login_url}                             │               │
│  │ {                                             │               │
│  │   "email": username,                         │               │
│  │   "password": password                       │               │
│  │ }                                             │               │
│  │                                               │               │
│  │ → Response: HTTP 200 OK                      │               │
│  └──────────────┬────────────────────────────────┘               │
│                 │                                                 │
│                 ▼                                                 │
│  ┌─────────────────────────────────────────────┐               │
│  │ Step 2: Extract Credentials                  │               │
│  │                                               │               │
│  │ IF auth_type == "jwt":                       │               │
│  │   → _extract_jwt_token()                     │               │
│  │     - Parse JSON response                     │               │
│  │     - Extract using token_json_path          │               │
│  │     - Return {"Authorization": "Bearer ..."}│               │
│  │                                               │               │
│  │ IF auth_type == "cookie":                    │               │
│  │   → _extract_cookies()                       │               │
│  │     - Get response.cookies                    │               │
│  │     - Return {"sessionid": "...", ...}       │               │
│  │                                               │               │
│  │ IF auth_type == "api_key":                   │               │
│  │   → _extract_api_key()                       │               │
│  │     - Parse JSON response                     │               │
│  │     - Extract using token_json_path          │               │
│  │     - Return {"X-API-Key": "..."}           │               │
│  └──────────────┬────────────────────────────────┘               │
│                 │                                                 │
│                 ▼                                                 │
│  Returns: (headers, cookies)                                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│     7. Engine Stores Credentials and Continues                   │
│                                                                  │
│  vulnerability_scan.auth_headers = headers                       │
│  vulnerability_scan.auth_cookies = cookies                       │
│  vulnerability_scan.save()                                       │
│                                                                  │
│  self.session.headers.update(auth_headers)                       │
│  self.session.cookies.update(auth_cookies)                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              8. Run Vulnerability Tests                          │
│                                                                  │
│  All HTTP requests automatically include authentication:         │
│                                                                  │
│  response = self.session.get(url)                               │
│  response = self.session.post(url, data=...)                    │
│                                                                  │
│  ✓ Headers included automatically                               │
│  ✓ Cookies included automatically                               │
│  ✓ No manual auth handling needed                               │
└─────────────────────────────────────────────────────────────────┘
```

## JSON Path Extraction

### How `extract_json_path()` Works

```python
# Example 1: Simple nested path
data = {
    "authentication": {
        "token": "eyJhbGci..."
    }
}

path = "authentication.token"
result = LoginHandler.extract_json_path(data, path)
# → "eyJhbGci..."

# Example 2: Deep nesting
data = {
    "data": {
        "user": {
            "profile": {
                "apiKey": "sk_live_123"
            }
        }
    }
}

path = "data.user.profile.apiKey"
result = LoginHandler.extract_json_path(data, path)
# → "sk_live_123"

# Example 3: Array access
data = {
    "items": [
        {"id": 1, "token": "first"},
        {"id": 2, "token": "second"}
    ]
}

path = "items.0.token"
result = LoginHandler.extract_json_path(data, path)
# → "first"
```

### Extraction Algorithm

```
1. Split path by dots: "auth.token" → ["auth", "token"]

2. Traverse each segment:
   - If current value is a dict:
     ✓ Check if key exists
     ✓ Navigate to value
     ✗ Log available keys if not found
   
   - If current value is a list:
     ✓ Try to parse segment as integer index
     ✓ Access array[index]
     ✗ Return None if out of bounds
   
   - Otherwise:
     ✗ Cannot navigate further

3. Return final value as string
```

## Error Handling Flow

```
┌─────────────────────────────────────────┐
│         login() Method                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Try: Perform login request              │
├──────────────────────────────────────────┤
│  Catch:                                  │
│    - Timeout         → Return (None, None)│
│    - ConnectionError → Return (None, None)│
│    - TooManyRedirects→ Return (None, None)│
│    - RequestException→ Return (None, None)│
│    - Exception       → Return (None, None)│
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Try: Extract credentials                │
├──────────────────────────────────────────┤
│  JWT:                                    │
│    - JSONDecodeError → Return None       │
│    - KeyError        → Return None       │
│    - TypeError       → Return None       │
│                                          │
│  Cookie:                                 │
│    - Exception       → Return None       │
│                                          │
│  API Key:                                │
│    - JSONDecodeError → Return None       │
│    - KeyError        → Return None       │
│    - TypeError       → Return None       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Validate credentials                    │
│    - Check not empty                     │
│    - Check correct type (dict)           │
│    - Check values not empty              │
│    - Log warnings for short values       │
└─────────────────────────────────────────┘
```

## Authentication Type Comparison

| Feature | JWT | Cookie | API Key |
|---------|-----|--------|---------|
| **Response Type** | JSON | HTTP Headers | JSON |
| **Extracted From** | Response body | Response.cookies | Response body |
| **Requires Path** | Yes (`token_json_path`) | No | Yes (`token_json_path`) |
| **Header Name** | `Authorization` (default) | N/A | `X-API-Key` (default) |
| **Format** | `Bearer {token}` | Cookie dict | Raw key |
| **Validation** | Length check | Cookie count | Length check |

## Use Cases

### Use Case 1: JWT Authentication

**Scenario:** Target API returns JWT token in nested JSON

```json
// Login Response
{
  "status": "success",
  "authentication": {
    "access_token": "eyJhbGci...",
    "refresh_token": "...",
    "expires_in": 3600
  }
}
```

**Configuration:**
```python
{
  "auth_type": "jwt",
  "login_url": "https://api.example.com/auth/login",
  "username": "admin@test.com",
  "password": "password123",
  "token_json_path": "authentication.access_token",
  "auth_header_name": "Authorization"
}
```

**Result:**
```python
headers = {
    "Authorization": "Bearer eyJhbGci..."
}
```

### Use Case 2: Session Cookie Authentication

**Scenario:** Target uses session-based auth with cookies

```http
HTTP/1.1 200 OK
Set-Cookie: sessionid=abc123def456; Path=/; HttpOnly
Set-Cookie: csrftoken=xyz789; Path=/
```

**Configuration:**
```python
{
  "auth_type": "cookie",
  "login_url": "https://app.example.com/login",
  "username": "testuser",
  "password": "testpass"
}
```

**Result:**
```python
cookies = {
    "sessionid": "abc123def456",
    "csrftoken": "xyz789"
}
```

### Use Case 3: API Key Authentication

**Scenario:** Target returns API key in JSON response

```json
// Login Response
{
  "data": {
    "user_id": 12345,
    "api_credentials": {
      "key": "sk_live_1234567890abcdef"
    }
  }
}
```

**Configuration:**
```python
{
  "auth_type": "api_key",
  "login_url": "https://api.example.com/authenticate",
  "username": "apiuser",
  "password": "apipass",
  "token_json_path": "data.api_credentials.key",
  "auth_header_name": "X-API-Key"
}
```

**Result:**
```python
headers = {
    "X-API-Key": "sk_live_1234567890abcdef"
}
```

## Testing the Flow

### Manual Test

```bash
# 1. Create recon scan (optional auth)
curl -X POST http://localhost:8000/api/recon/scans/ \
  -H "Content-Type: application/json" \
  -d '{
    "target": "https://example.com"
  }'

# 2. Create vulnerability scan with auto-login
curl -X POST http://localhost:8000/api/vulnerability-detection/scans/ \
  -H "Content-Type: application/json" \
  -d '{
    "recon_scan": 1,
    "vulnerability_type": "A01_BAC",
    "auth_type": "jwt",
    "login_url": "https://example.com/api/login",
    "username": "admin@test.com",
    "password": "password123",
    "token_json_path": "auth.token"
  }'

# 3. Execute scan
curl -X POST http://localhost:8000/api/vulnerability-detection/scans/1/execute/
```

### Check Logs

```bash
# Monitor server logs for authentication flow
tail -f backend/runserver.log | grep -E "Login|Auth|Token|Cookie"
```

Expected log output:
```
INFO - Attempting login to https://example.com/api/login as user admin@test.com
INFO - Login successful (status 200)
INFO - Successfully extracted JWT token (length: 245)
INFO - JWT authentication successful
INFO - Auto-login successful: extracted 1 headers
INFO - Loaded 1 authentication headers
```

## Troubleshooting Guide

### Issue: "No credentials extracted"

**Possible Causes:**
1. ❌ Wrong `token_json_path`
2. ❌ Login failed (401/403)
3. ❌ Response is not JSON

**Solution:**
```bash
# Enable debug logging
import logging
logging.getLogger('vulnerability_detection.login_handler').setLevel(logging.DEBUG)

# Check logs for:
# - Response structure
# - Available keys
# - Path traversal details
```

### Issue: "Token not found at path"

**Possible Causes:**
1. ❌ Incorrect path syntax
2. ❌ Misspelled key names
3. ❌ Response structure different than expected

**Solution:**
```python
# Test path extraction manually
from vulnerability_detection.login_handler import LoginHandler

data = {"auth": {"token": "test123"}}
result = LoginHandler.extract_json_path(data, "auth.token")
print(result)  # Should print "test123"

# Check response structure
print(json.dumps(response_json, indent=2))
```

### Issue: "Authentication test failed"

**Possible Causes:**
1. ❌ Token expired
2. ❌ Wrong header name
3. ❌ Missing Bearer prefix

**Solution:**
```python
# Validate manually with curl
curl https://api.example.com/protected \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Check if response is 200 OK
```

## Best Practices

### ✅ DO:
- Use dedicated test accounts with limited permissions
- Validate credentials after extraction with `validate_credentials()`
- Enable debug logging during development
- Test auto-login with real targets before production use
- Rotate credentials regularly
- Use descriptive `token_json_path` comments

### ❌ DON'T:
- Store production credentials in the database
- Log plaintext passwords (already prevented)
- Use admin accounts for testing
- Skip validation of extracted credentials
- Hardcode credentials in code
- Ignore failed login attempts

## Security Considerations

⚠️ **Critical Security Notes:**

1. **Plaintext Password Storage**
   - Passwords stored unencrypted in database
   - Use only for testing/development
   - Never use production credentials

2. **Credential Logging**
   - Passwords: ❌ Never logged
   - Tokens: ✓ First 20-30 chars logged (debug only)
   - Cookies: ✓ Names logged, values masked

3. **Network Security**
   - Always use HTTPS for login_url
   - Validate SSL certificates
   - Monitor for MITM attacks

4. **Access Control**
   - Limit who can create vulnerability scans
   - Audit auto-login usage
   - Monitor authentication failures

---

**Last Updated:** March 6, 2026  
**Module:** `vulnerability_detection.login_handler`  
**Flow Version:** 2.0 (Refactored)
