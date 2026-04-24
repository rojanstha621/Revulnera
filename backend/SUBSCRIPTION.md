# Subscription System Documentation

## Overview

The subscription system allows you to manage different tiers of service for your users with varying capabilities and pricing. The system includes three tiers:

- **Free** - Limited features, no charge
- **Pro** - Enhanced capabilities with monthly billing ($9.99/month)
- **Plus** - Maximum capabilities, enterprise features ($29.99/month)

## Models

### 1. SubscriptionPlan
Represents a predefined subscription plan with feature limits and capabilities.

**Fields:**
- `name` - Unique identifier ('free', 'pro', 'plus')
- `display_name` - User-friendly name (e.g., "Professional")
- `description` - Plan description
- `price_per_month` - Price in cents (e.g., 999 = $9.99)
- `max_scans_per_month` - Monthly scan limit (null = unlimited)
- `max_concurrent_scans` - Number of simultaneous scans allowed
- `max_storage_gb` - Maximum storage quota
- `api_rate_limit_per_minute` - API call rate limit
- `support_level` - Support tier (email, priority, 24/7)
- `advanced_reporting` - Boolean for enhanced reports
- `custom_integrations` - Boolean for custom API integrations
- `dedicated_account_manager` - Boolean for dedicated support
- `is_active` - Boolean to enable/disable plan

### 2. UserSubscription
Tracks the current subscription status for each user.

**Fields:**
- `user` - OneToOne reference to User
- `plan` - ForeignKey to SubscriptionPlan
- `status` - Current status ('active', 'canceled', 'expired', 'suspended')
- `current_period_start` - Billing period start date
- `current_period_end` - Billing period end date
- `subscription_id` - External payment processor ID (Stripe, PayPal, etc.)
- `auto_renew` - Boolean for automatic renewal

**Properties:**
- `is_active` - Returns True if subscription is active and not expired
- `days_remaining` - Calculates days left in current billing period

### 3. SubscriptionUsage
Tracks usage metrics within the current billing period.

**Fields:**
- `user` - OneToOne reference to User
- `scans_used_this_month` - Count of scans used
- `current_storage_used_gb` - Storage consumption
- `api_calls_today` - API calls made today
- `usage_period_start` - When the current billing period started

### 4. SubscriptionHistory
Audit trail of all subscription changes.

**Fields:**
- `user` - ForeignKey to User
- `old_plan` - Previous plan (nullable for first upgrade)
- `new_plan` - New plan after change
- `change_type` - Type of change (upgrade, downgrade, renewal, cancellation, suspension, reactivation)
- `reason` - Reason for change (optional)
- `changed_at` - Timestamp of change

## API Endpoints

### List Available Plans
```
GET /api/accounts/plans/
```
Returns all active subscription plans.

**Response:**
```json
[
  {
    "id": 1,
    "name": "free",
    "display_name": "Free",
    "description": "Perfect for getting started...",
    "price_per_month": 0,
    "price_per_month_display": "$0.00",
    "max_scans_per_month": 5,
    "max_concurrent_scans": 1,
    "max_storage_gb": 1,
    "api_rate_limit_per_minute": 10,
    "support_level": "email",
    "advanced_reporting": false,
    "custom_integrations": false,
    "dedicated_account_manager": false,
    "is_active": true
  }
]
```

### Get User's Current Subscription
```
GET /api/accounts/subscription/
```
Returns authenticated user's current subscription with usage statistics.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 1,
  "plan": {
    "id": 1,
    "name": "free",
    "display_name": "Free",
    ...
  },
  "status": "active",
  "current_period_start": "2024-04-01T00:00:00Z",
  "current_period_end": "2024-05-01T00:00:00Z",
  "auto_renew": true,
  "is_active": true,
  "days_remaining": 16,
  "created_at": "2024-04-01T10:30:00Z",
  "updated_at": "2024-04-01T10:30:00Z",
  "usage": {
    "scans_used_this_month": 2,
    "scans_remaining": 3,
    "current_storage_used_gb": 0.5,
    "storage_remaining_gb": 0.5,
    "api_calls_today": 45,
    "usage_period_start": "2024-04-01T00:00:00Z",
    "last_updated": "2024-04-05T14:20:00Z",
    "plan_name": "Free"
  }
}
```

### Upgrade or Downgrade Plan
```
POST /api/accounts/subscription/upgrade/
```
Change to a different subscription plan.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "plan_id": 2,
  "reason": "Need more scan limits"
}
```

**Response:**
```json
{
  "detail": "Successfully upgraded to Professional",
  "subscription": {
    ...subscription data...
  }
}
```

### Cancel Subscription
```
POST /api/accounts/subscription/cancel/
```
Downgrade to free plan and cancel paid subscription.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "No longer needed"
}
```

**Response:**
```json
{
  "detail": "Subscription canceled. You are now on the free plan"
}
```

### Get Subscription History
```
GET /api/accounts/subscription/history/
```
Get all subscription changes for the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "old_plan": 1,
    "old_plan_name": "Free",
    "new_plan": 2,
    "new_plan_name": "Professional",
    "change_type": "upgrade",
    "reason": "Need more capabilities",
    "changed_at": "2024-04-05T10:30:00Z"
  }
]
```

## Default Subscription Plans

### Free Plan
- **Price:** $0.00/month
- **Max Scans:** 5 per month
- **Concurrent Scans:** 1
- **Storage:** 1 GB
- **API Rate:** 10 calls/minute
- **Support:** Email
- **Features:** Basic scanning only

### Pro Plan
- **Price:** $9.99/month
- **Max Scans:** 50 per month
- **Concurrent Scans:** 3
- **Storage:** 50 GB
- **API Rate:** 100 calls/minute
- **Support:** Priority
- **Features:** Advanced reporting, Basic integrations

### Plus Plan
- **Price:** $29.99/month
- **Max Scans:** Unlimited
- **Concurrent Scans:** 10
- **Storage:** 500 GB
- **API Rate:** 1000 calls/minute
- **Support:** 24/7
- **Features:** Advanced reporting, Custom integrations, Dedicated account manager

## Setup Instructions

### 1. Run Migrations
```bash
python manage.py migrate accounts
```

### 2. Initialize Default Plans
```bash
python manage.py init_subscription_plans
```

### 3. Assign Free Plan to Existing Users (Optional)
If you have existing users and want to assign them the free plan automatically, you can use the signal in `accounts/signals.py` which should handle this on user creation.

## Integration Points

### Checking User's Subscription in Views
```python
from accounts.models import UserSubscription

def my_view(request):
    subscription = request.user.subscription
    plan = subscription.plan
    
    # Check if user has pro or plus plan
    if plan.name in ['pro', 'plus']:
        # Allow premium features
        pass
    
    # Check usage limits
    usage = request.user.subscription_usage
    if usage.scans_used_this_month >= plan.max_scans_per_month:
        # User has exhausted monthly scans
        pass
```

### Tracking Usage
Update usage after performing scanned operations:
```python
from accounts.models import SubscriptionUsage

usage = SubscriptionUsage.objects.get(user=user)
usage.scans_used_this_month += 1
usage.save()
```

### Checking Limits
```python
def can_start_scan(user, scan_type='normal'):
    subscription = user.subscription
    usage = user.subscription_usage
    plan = subscription.plan
    
    # Check if user can run scans
    if not user.can_run_vulnerability_scans:
        return False, "Scans not approved"
    
    # Check subscription status
    if not subscription.is_active:
        return False, "Subscription expired"
    
    # Check monthly limit
    if plan.max_scans_per_month is not None:
        if usage.scans_used_this_month >= plan.max_scans_per_month:
            return False, "Monthly scan limit exceeded"
    
    # Check concurrent scans (would need to query active scans)
    active_scans = user.scans.filter(status='running').count()
    if active_scans >= plan.max_concurrent_scans:
        return False, "Concurrent scan limit exceeded"
    
    return True, ""
```

## Admin Panel

The subscription system is fully integrated with Django admin:

1. **Subscription Plans** - Create/edit/delete plans
2. **User Subscriptions** - View and manage user subscriptions
3. **Subscription Usage** - Monitor usage per user
4. **Subscription History** - Audit trail of all changes

### Admin URLs:
- Plans: `/admin/accounts/subscriptionplan/`
- User Subscriptions: `/admin/accounts/usersubscription/`
- Usage: `/admin/accounts/subscriptionusage/`
- History: `/admin/accounts/subscriptionhistory/`

## Payment Integration (Next Steps)

For payment processing, you'll want to integrate:
- **Stripe** - Most common for subscriptions
- **PayPal** - Alternative payment processor
- **Razorpay** - For international payments

When integrating payments:
1. Store the payment processor subscription ID in `UserSubscription.subscription_id`
2. Handle webhook events for payment success/failure
3. Update subscription status based on payment events
4. Create `SubscriptionHistory` entries for audit trail

## Frontend Integration Example

```javascript
// Get available plans
async function getPlans() {
  const response = await fetch('/api/accounts/plans/');
  return await response.json();
}

// Get user's current subscription
async function getUserSubscription() {
  const response = await fetch('/api/accounts/subscription/', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await response.json();
}

// Upgrade to pro
async function upgradeToPro() {
  const response = await fetch('/api/accounts/subscription/upgrade/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      plan_id: 2,
      reason: "User selected pro plan"
    })
  });
  return await response.json();
}

// Cancel subscription
async function cancelSubscription() {
  const response = await fetch('/api/accounts/subscription/cancel/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reason: "User canceled"
    })
  });
  return await response.json();
}
```

## Best Practices

1. **Always check subscription status** before allowing premium features
2. **Track usage accurately** to enforce limits properly
3. **Create history entries** for audit and compliance
4. **Reset usage monthly** - consider a management command or celery task
5. **Handle expired subscriptions** gracefully - allow grace period before downgrading
6. **Notify users** when approaching usage limits
7. **Keep payment IDs synced** with payment processor webhooks
8. **Log all changes** for security and debugging

## Troubleshooting

### User created without subscription
Add `UserSubscription.objects.create()` to user creation signal or manually:
```bash
python manage.py shell
```
```python
from accounts.models import User, UserSubscription, SubscriptionPlan
from django.utils import timezone

user = User.objects.get(email='user@example.com')
free_plan = SubscriptionPlan.objects.get(name='free')
UserSubscription.objects.create(
    user=user,
    plan=free_plan,
    current_period_start=timezone.now(),
    current_period_end=timezone.now() + timezone.timedelta(days=30),
    status='active'
)
```

### Reset usage for new period
```python
from accounts.models import SubscriptionUsage
from django.utils import timezone

usage = SubscriptionUsage.objects.get(user=user)
usage.scans_used_this_month = 0
usage.api_calls_today = 0
usage.usage_period_start = timezone.now()
usage.save()
```

## Support

For issues or questions about the subscription system, refer to:
- Django documentation: https://docs.djangoproject.com/
- Django REST Framework: https://www.django-rest-framework.org/
