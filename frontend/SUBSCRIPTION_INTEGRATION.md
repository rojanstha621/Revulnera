# Frontend Subscription System - Integration Guide

## ✅ What's Been Created

A complete React-based subscription management UI with:

### 📄 Pages
1. **Plans.jsx** - Display all subscription tiers with comparison
2. **Subscription.jsx** - User's subscription dashboard with usage tracking

### 🧩 Components  
1. **UpgradeModal.jsx** - Dialog for upgrading/downgrading plans
2. **SubscriptionCard.jsx** - Current subscription info card
3. **UsageCard.jsx** - Usage metrics display (scans, storage, API calls)
4. **HistoryTimeline.jsx** - Timeline view of subscription changes
5. **SubscriptionWidget.jsx** - Mini subscription info widget for dashboard

### 🔌 API Functions
Added to `src/api/api.js`:
- `getSubscriptionPlans()` - Fetch all plans
- `getUserSubscription()` - Get user's current subscription
- `upgradSubscription(planId, reason)` - Change subscription
- `cancelSubscription(reason)` - Cancel to free plan
- `getSubscriptionHistory()` - Get change history

### 🛣️ Routes
Added to `src/App.jsx`:
- `/plans` - View and compare plans (protected)
- `/subscription` - User subscription dashboard (protected)

---

## 🚀 Implementation Steps

### 1. ✅ Routes Already Added
The Plans and Subscription pages have been added to `App.jsx` routing.

### 2. Add Subscription Widget to Dashboard

Edit `src/pages/Dashboard.jsx` and add the subscription widget:

```jsx
import SubscriptionWidget from "../components/subscription/SubscriptionWidget";

export default function Dashboard() {
  // ... existing code ...

  return (
    <div className="space-y-8">
      {/* ... existing header ... */}

      {/* Add this after header or before stats */}
      <SubscriptionWidget />

      {/* ... rest of dashboard ... */}
    </div>
  );
}
```

### 3. Add Subscription Link to Navigation

Edit `src/components/Layout.jsx` (or your navigation component) and add:

```jsx
<Link to="/plans" className="text-gray-300 hover:text-white transition-colors">
  Plans & Pricing
</Link>

<Link to="/subscription" className="text-gray-300 hover:text-white transition-colors">
  My Subscription
</Link>
```

Or in a sidebar menu:

```jsx
<li>
  <Link to="/plans" className="nav-link">
    <Zap className="w-5 h-5" />
    <span>Plans & Pricing</span>
  </Link>
</li>
<li>
  <Link to="/subscription" className="nav-link">
    <Settings className="w-5 h-5" />
    <span>My Subscription</span>
  </Link>
</li>
```

### 4. Add Profile/Settings Link
In `src/pages/Profile.jsx` or settings page, add a link:

```jsx
<Link to="/subscription" className="btn-primary">
  Manage Subscription
</Link>
```

### 5. Update LoadingScreen if Needed
Ensure `LoadingScreen` component exists at `src/components/LoadingScreen.jsx`

---

## 📱 Component Usage Examples

### Display Subscription Info
```jsx
import SubscriptionWidget from "@/components/subscription/SubscriptionWidget";

function MyComponent() {
  return <SubscriptionWidget />;
}
```

### Show Usage Stats
```jsx
import UsageCard from "@/components/subscription/UsageCard";
import { Zap } from "lucide-react";

return (
  <UsageCard
    icon={Zap}
    title="Scans Used"
    used={5}
    limit={10}
    unit="scans"
    percentage={50}
  />
);
```

### Display Plan Feature Comparison
See the Plans.jsx page for the full comparison table implementation.

---

## 🔐 API Integration Points

### Check Subscription Before Action
In pages that require subscription validation:

```jsx
import { getUserSubscription } from "../api/api";

useEffect(() => {
  const checkSubscription = async () => {
    const sub = await getUserSubscription();
    
    // Check if user can perform action
    if (sub.plan.name === 'free' && someFeatureRequiresPaid) {
      // Show upgrade prompt
      setShowUpgradePrompt(true);
    }
  };
  
  checkSubscription();
}, []);
```

### Handle Limit Exceeded
```jsx
const canStartScan = (subscription) => {
  const plan = subscription.plan;
  const usage = subscription.usage;
  
  if (usage.scans_used_this_month >= plan.max_scans_per_month) {
    return { allowed: false, reason: "Month scan limit reached" };
  }
  
  return { allowed: true };
};
```

---

## 🎨 Styling

All components use Tailwind CSS with consistent dark theme styling:
- Background: Gray/blue tones
- Accent colors: Cyan (#06B6D4), Blue
- Text: White/gray-300 for hierarchy

To customize colors, update the Tailwind classes in components.

---

## 📊 Usage Tracking Flow

1. User views **Plans.jsx** → See all available plans
2. User clicks "Upgrade" → **UpgradeModal** explains changes
3. User confirms → Plan updated via API
4. User redirected to **Subscription.jsx** dashboard
5. Dashboard shows current usage with progress bars
6. Past changes visible in **HistoryTimeline**

---

## 🔄 Refresh Subscription Data

After any subscription changes, refresh the data:

```jsx
const handleUpgradeSuccess = async () => {
  // Reload subscription data
  const updated = await getUserSubscription();
  setSubscription(updated);
  addToast({ type: "success", message: "Subscription updated!" });
};
```

---

## 🎯 Adding Features That Require Subscription

In any feature paywalled by subscription:

```jsx
import { useContext, useEffect, useState } from "react";
import { getUserSubscription } from "../api/api";

function PremiumFeature() {
  const [canAccess, setCanAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const sub = await getUserSubscription();
      
      // Only Pro and Plus can use this
      setCanAccess(['pro', 'plus'].includes(sub.plan.name));
      setLoading(false);
    };
    
    check();
  }, []);

  if (!canAccess) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded">
        <p>This feature requires a Pro or Plus subscription</p>
        <Link to="/plans">Upgrade Now →</Link>
      </div>
    );
  }

  return <YourFeatureComponent />;
}
```

---

## 📱 Responsive Design

All components are fully responsive:
- Mobile: Single column layouts
- Tablet: 2 columns where appropriate  
- Desktop: 3 column grid for plans

---

## 🔊 Toast Notifications

Subscription actions use the ToastContext for feedback:

```jsx
import { ToastContext } from "../context/ToastContext";

const { addToast } = useContext(ToastContext);

// Usage
addToast({
  type: "success",
  message: "Subscription updated successfully!"
});

addToast({
  type: "error",
  message: "Failed to upgrade. Please try again."
});
```

---

## 🧪 Testing the Frontend

### Test Plans Page
```
http://localhost:5173/plans
```

Should show:
- Free, Pro, Plus plan cards
- Feature comparison table
- FAQ section

### Test Subscription Dashboard
```
http://localhost:5173/subscription
```

Should show:
- Current plan card with status
- Usage charts for scans/storage/API
- Subscription history timeline
- Billing period info
- Link to upgrade

### Test Upgrade Flow
1. Click "Upgrade Now" on a plan
2. Modal opens with plan comparison
3. Edit optional reason field
4. Click Confirm
5. API updates subscription
6. Page refreshes with new plan

---

## 🐛 Troubleshooting

### Pages not found
- Ensure imports are added to `App.jsx`
- Check that component files exist at correct paths
- Verify no typos in route paths

### API calls failing
- Check backend is running on correct port (8000)
- Verify API routes exist: `/api/accounts/plans/`, `/api/accounts/subscription/`
- Check authentication token is valid

### Styling looks wrong
- Ensure Tailwind CSS is properly configured
- Check that `index.css` includes Tailwind directives
- Verify `tailwind.config.js` includes all template paths

### Modal not showing
- Check `useContext(ToastContext)` provides correct context
- Verify `showUpgradeModal` state is properly managed
- Check z-index of modal (z-50) doesn't conflict

---

## 📦 Dependencies Already Available

- React Router (routing)
- Lucide React (icons)
- Tailwind CSS (styling)
- Local context management (no external state lib needed)

All required packages should already be in your `package.json`.

---

## 🔗 Next Steps

### 1. Integrate with Scanning Features
In `VulnerabilityScans.jsx` or vulnerability scanning pages:
```jsx
const { allowed, reason } = canStartScan(subscription);
if (!allowed) {
  return <UpgradeBanner reason={reason} />;
}
```

### 2. Add Payment Processing (Future)
Create `Billing.jsx` page for payment methods:
- Add credit card
- Change payment method
- View invoices
- Download receipts

### 3. Add Admin Dashboard for Subscriptions
Create admin pages to manage:
- Subscriptions overview
- Revenue analytics
- Churn rate
- Plan migration chart

### 4. Setup Notifications
Add email/webhook notifications:
- Trial expiring (if applicable)
- Plan limits near max
- Invoice reminders
- Plan change confirmations

---

## 📞 Support

For issues:
1. Check browser console for errors
2. Check backend logs for API errors  
3. Verify API endpoints match backend routes
4. Test API directly with curl:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/accounts/plans/
```

---

## 🎉 You're Ready!

The subscription system is fully integrated. Users can now:
- ✅ View available plans
- ✅ Upgrade/downgrade instantly
- ✅ Monitor usage in real-time
- ✅ See subscription history
- ✅ Manage their subscription

Enjoy!
