# User Management System Changes

## Overview
Updated the user management system to remove email verification requirements for login while adding an approval system specifically for vulnerability scanning features.

## Changes Summary

### 1. **Removed Email Verification for Login** ✅
- Users can now register and login immediately without email verification
- `is_active` field now defaults to `True` for new users
- Registration endpoint no longer sends verification emails
- Login endpoint no longer checks for email verification

### 2. **Added Vulnerability Scan Approval System** ✅
- New field: `can_run_vulnerability_scans` (Boolean, default: `False`)
- Users need explicit admin approval to access vulnerability scanning features
- Staff users always have access to vulnerability scanning
- Regular users see permission denied message until approved

## User Access Levels

| Feature | All Users | Approved Users | Staff/Admin |
|---------|-----------|----------------|-------------|
| Register & Login | ✅ | ✅ | ✅ |
| Run Recon Scans | ✅ | ✅ | ✅ |
| Access Vulnerability Scans | ❌ | ✅ | ✅ |
| Create Vulnerability Scans | ❌ | ✅ | ✅ |
| Execute Vulnerability Scans | ❌ | ✅ | ✅ |
| Approve Other Users | ❌ | ❌ | ✅ |

## Technical Implementation

### Model Changes
**File:** `backend/accounts/models.py`

```python
class User(AbstractBaseUser, PermissionsMixin):
    # Changed from default=False to default=True
    is_active = models.BooleanField(default=True)
    
    # NEW FIELD
    can_run_vulnerability_scans = models.BooleanField(
        default=False,
        help_text="User needs admin approval to run vulnerability scans"
    )
```

### Permission Class
**File:** `backend/vulnerability_detection/permissions.py`

```python
class CanAccessVulnerabilityScans(permissions.BasePermission):
    """
    Permission to access vulnerability scanning features.
    Requires admin approval or staff status.
    """
    message = "You need admin approval to access vulnerability scanning. Please contact an administrator."
    
    def has_permission(self, request, view):
        if request.user.is_staff:
            return True
        return getattr(request.user, 'can_run_vulnerability_scans', False)
```

### Views Updated
**File:** `backend/vulnerability_detection/views.py`

All vulnerability detection viewsets now require `CanAccessVulnerabilityScans` permission:
- `VulnerabilityScanViewSet`
- `VulnerabilityFindingViewSet`
- `VulnerabilityTestLogViewSet`

### Admin Interface
**File:** `backend/accounts/admin.py`

New features in Django admin:
- **Display Column:** Shows approval status with ✅/❌ icons
- **Filter:** Filter users by vulnerability scan approval status
- **Bulk Actions:**
  - "✅ Approve for vulnerability scanning"
  - "❌ Revoke vulnerability scanning access"
- **Fieldset:** Added "Vulnerability Scanning" section in user edit form

## Admin Usage Guide

### Approving Users for Vulnerability Scanning

#### Method 1: Individual Approval
1. Go to Django Admin → Users
2. Click on a user
3. Scroll to "Vulnerability Scanning" section
4. Check "Can run vulnerability scans"
5. Click "Save"

#### Method 2: Bulk Approval
1. Go to Django Admin → Users
2. Select multiple users using checkboxes
3. Choose "✅ Approve for vulnerability scanning" from Action dropdown
4. Click "Go"

### Monitoring Approval Status
- List view shows approval status in "Vuln Scan Access" column
- Filter users by "can_run_vulnerability_scans" field
- See who has access at a glance with visual indicators

## API Changes

### JWT Token Claims
**File:** `backend/accounts/views.py`

JWT tokens now include the approval status:
```python
{
    "email": "user@example.com",
    "full_name": "User Name",
    "role": "user",
    "is_staff": false,
    "can_run_vulnerability_scans": true  # NEW FIELD
}
```

### User Serializer
**File:** `backend/accounts/serializers.py`

User API responses now include:
```json
{
    "id": 1,
    "email": "user@example.com",
    "full_name": "User Name",
    "role": "user",
    "is_active": true,
    "is_staff": false,
    "can_run_vulnerability_scans": false,
    "date_joined": "2026-03-04T00:00:00Z"
}
```

### Permission Error Response
When unapproved users try to access vulnerability scans:

**Status:** `403 Forbidden`
```json
{
    "detail": "You need admin approval to access vulnerability scanning. Please contact an administrator."
}
```

## Migration

**Migration File:** `accounts/migrations/0003_user_can_run_vulnerability_scans_and_more.py`

This migration:
1. Adds `can_run_vulnerability_scans` field (default: `False`)
2. Changes `is_active` default from `False` to `True`

**Run with:**
```bash
python manage.py migrate accounts
```

## User Workflows

### New User Registration Flow
1. User registers at `/auth/register`
2. User is created with `is_active=True`, `can_run_vulnerability_scans=False`
3. User can immediately login (no email verification needed)
4. User can run recon scans
5. User sees permission error when accessing vulnerability scans
6. Admin approves user for vulnerability scanning
7. User can now access all vulnerability scanning features

### Admin Approval Workflow
1. User requests vulnerability scanning access
2. Admin receives notification/request
3. Admin logs into Django Admin
4. Admin finds user and checks their activity
5. Admin approves user (individual or bulk)
6. User gains immediate access to vulnerability scanning

## Testing Results

✅ Unapproved users blocked from vulnerability scans (403 Forbidden)  
✅ Approved users can access vulnerability scans (200 OK)  
✅ Staff users always have access  
✅ New users can login without email verification  
✅ JWT tokens include approval status  
✅ Admin interface shows approval controls  

## Frontend Considerations

### Recommended Frontend Updates
1. **Check user permissions on login:**
   ```javascript
   const canAccessVulnScans = user.can_run_vulnerability_scans || user.is_staff;
   ```

2. **Show approval status in UI:**
   - Display message to unapproved users: "Vulnerability scanning requires admin approval"
   - Provide contact/request button for approval

3. **Hide/disable vulnerability scan features:**
   - Conditionally show "Vulnerabilities" menu item
   - Disable "Run Vulnerability Scan" buttons
   - Show upgrade/approval prompt

4. **Handle 403 errors gracefully:**
   ```javascript
   catch (error) {
     if (error.response?.status === 403) {
       showMessage("Please request admin approval for vulnerability scanning");
     }
   }
   ```

## Removed Features

The following email verification endpoints are now unused but kept for backward compatibility:
- `POST /api/accounts/verify/` - Verify email
- `POST /api/accounts/resend-verify/` - Resend verification email

These can be safely removed if not needed.

## Security Considerations

✅ **Access Control:** Vulnerability scanning is gated by admin approval  
✅ **Least Privilege:** Users start with minimal permissions  
✅ **Audit Trail:** Admin actions are logged  
✅ **Staff Override:** Staff always have access for operational needs  

## Rollback Plan

If you need to revert these changes:

1. **Restore email verification:**
   ```python
   # In accounts/models.py
   is_active = models.BooleanField(default=False)
   ```

2. **Remove vulnerability scan permission:**
   ```python
   # In vulnerability_detection/views.py
   permission_classes = [IsAuthenticated]  # Remove CanAccessVulnerabilityScans
   ```

3. **Run migration:**
   ```bash
   python manage.py migrate accounts 0002_previous_migration
   ```
