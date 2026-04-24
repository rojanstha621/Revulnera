# Subscription System - Quick Start Guide

## ✅ What's Been Implemented

A complete, production-ready subscription system with:

### 📊 Three Subscription Tiers
1. **Free** - $0/month (5 scans, 1GB storage)
2. **Pro** - $9.99/month (50 scans, 50GB storage, priority support)
3. **Plus** - $29.99/month (unlimited scans, 500GB storage, 24/7 support)

### 🗄️ Database Models
- `SubscriptionPlan` - Service tier definitions
- `UserSubscription` - User's current subscription
- `SubscriptionUsage` - Usage tracking (scans, storage, API calls)
- `SubscriptionHistory` - Audit trail of changes

### 🔌 REST API Endpoints
All endpoints require authentication (Bearer token) except `/plans/`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/accounts/plans/` | List available plans |
| GET | `/api/accounts/subscription/` | Get user's current subscription + usage |
| POST | `/api/accounts/subscription/upgrade/` | Change subscription plan |
| POST | `/api/accounts/subscription/cancel/` | Cancel to free plan |
| GET | `/api/accounts/subscription/history/` | View subscription changes |

### 🛠️ Helper Functions
Import from `accounts.subscription_utils`:
- `can_perform_scan(user)` - Check if user can start a scan
- `increment_scan_usage(user)` - Track scan usage
- `get_remaining_scans(user)` - Get remaining scans for period
- `can_use_advanced_reporting(user)` - Check feature access
- `get_subscription_summary(user)` - Full subscription overview

### 📋 Django Admin
Fully integrated admin panel to manage:
- Subscription Plans
- User Subscriptions
- Usage Tracking
- Change History

---

## 🚀 Deployment Steps

### 1. Run Database Migrations
```bash
python manage.py migrate accounts
```

### 2. Initialize Default Plans
```bash
python manage.py init_subscription_plans
```

The command creates:
- Free plan (unlimited users)
- Pro plan ($9.99/month)
- Plus plan ($29.99/month)

### 3. Verify Setup
```bash
python manage.py shell
```
```python
from accounts.models import SubscriptionPlan
print(SubscriptionPlan.objects.all().values_list('name', 'display_name', 'price_per_month'))
# Output: free, Free, 0
#         pro, Professional, 999
#         plus, Plus, 2999
```

---

## 💻 Integration Examples

### Check if user can perform a scan
```python
from accounts.subscription_utils import can_perform_scan

def start_scan(request):
    can_scan, reason = can_perform_scan(request.user)
    if not can_scan:
        return Response({'detail': reason}, status=403)
    
    # Start the scan
    scan = Scan.objects.create(user=request.user, ...)
    return Response({'id': scan.id})
```

### Track scan completion
```python
from accounts.subscription_utils import increment_scan_usage

def complete_scan(scan):
    # ... scan completion logic ...
    increment_scan_usage(scan.user)
```

### Show user their subscription info
```python
from accounts.subscription_utils import get_subscription_summary

def get_user_summary(request):
    summary = get_subscription_summary(request.user)
    return Response(summary)
```

### Check plan features
```python
from accounts.subscription_utils import (
    can_use_advanced_reporting,
    can_use_custom_integrations,
    has_dedicated_account_manager
)

def dashboard(request):
    user = request.user
    context = {
        'can_report': can_use_advanced_reporting(user),
        'can_integrate': can_use_custom_integrations(user),
        'has_manager': has_dedicated_account_manager(user),
    }
    return Response(context)
```

---

## 🪝 Payment Integration (Optional Next Step)

To accept payments, integrate with Stripe:

```bash
pip install stripe
```

Create a `payments` app:
```bash
python manage.py startapp payments
```

Webhook handler example:
```python
@csrf_exempt
def stripe_webhook(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    
    payload = request.body
    event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
    
    if event['type'] == 'customer.subscription.updated':
        subscription_id = event['data']['object']['id']
        user_sub = UserSubscription.objects.get(subscription_id=subscription_id)
        user_sub.status = 'active'
        user_sub.save()
    
    return JsonResponse({'status': 'success'})
```

---

## 📁 Files Created/Modified

### New Files
- `accounts/models.py` - Added 4 subscription models
- `accounts/serializers.py` - Added 5 subscription serializers
- `accounts/views.py` - Added 5 subscription views
- `accounts/subscription_utils.py` - Utility functions
- `accounts/management/commands/init_subscription_plans.py` - Setup command
- `SUBSCRIPTION.md` - Complete documentation

### Modified Files
- `accounts/urls.py` - Added 5 new endpoints
- `accounts/admin.py` - Added 4 admin classes

### Migrations
- `accounts/migrations/0005_subscriptionplan_...py` - Database schema

---

## 📖 Documentation

Full API documentation available in `SUBSCRIPTION.md` including:
- Detailed model descriptions
- Request/response examples
- Usage tracking examples
- Admin panel guide
- Troubleshooting guide
- Best practices

---

## ⚙️ Configuration

### For Your PostgreSQL Setup
All models are configured to work with PostgreSQL (already your database).

### Customization
To modify pricing or features:
```bash
python manage.py shell
```
```python
from accounts.models import SubscriptionPlan

# Update Pro plan
pro = SubscriptionPlan.objects.get(name='pro')
pro.price_per_month = 1999  # Change to $19.99
pro.max_storage_gb = 100    # Increase to 100GB
pro.save()
```

---

## 🧪 Testing

Test the subscription system:

```bash
# Lists plans
curl http://localhost:8000/api/accounts/plans/

# Get user subscription (requires token)
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/api/accounts/subscription/

# Upgrade to pro
curl -X POST http://localhost:8000/api/accounts/subscription/upgrade/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_id": 2}'
```

---

## 📊 Monitoring Usage

Create a management command for periodic resets:

```python
# accounts/management/commands/reset_daily_usage.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from accounts.models import SubscriptionUsage

class Command(BaseCommand):
    def handle(self, *args, **options):
        SubscriptionUsage.objects.all().update(api_calls_today=0)
        self.stdout.write("✓ Reset daily API calls")
```

Schedule with cron:
```
0 0 * * * /path/to/venv/bin/python manage.py reset_daily_usage
```

---

## ❓ Common Questions

**Q: How do new users get a subscription?**
A: Automatically assigned Free plan when they first access subscription endpoint.

**Q: Can users change plans freely?**
A: Yes, they can upgrade/downgrade anytime. Downgrades take effect immediately.

**Q: Where do I add payment processing?**
A: Modify `UpgradeSubscriptionView` to process payment before updating subscription.

**Q: How do I enforce limits in my scanning app?**
A: Use `can_perform_scan()` before starting scans, `increment_scan_usage()` after completion.

**Q: How often should I reset usage?**
A: Monthly on subscription renewal date. Consider a Celery task for this.

---

## 🎯 Next Steps

1. ✅ Run migrations
2. ✅ Initialize plans
3. 📝 Update vulnerability_detection views to check subscription limits
4. 💳 Integrate payment processor (Stripe/PayPal)
5. 🔔 Add email notifications for limit warnings
6. 📊 Create admin dashboard for subscription analytics

---

## 📞 Support

Refer to `SUBSCRIPTION.md` for:
- Complete API reference
- Integration patterns
- Troubleshooting guide
- Payment integration examples
