# Revulnera User Manual

## 1. What Revulnera Is

Revulnera is a security reconnaissance and analysis platform for discovering subdomains, live hosts, web endpoints, open ports, TLS issues, and common directory misconfigurations. It also includes reporting, subscription management, vulnerability scanning, and admin tools.

The system is split into three main parts:

- React frontend for the user interface
- Django backend for authentication, scan orchestration, reporting, and subscriptions
- Go scanner worker for fast recon, endpoint discovery, and network analysis

## 2. Who This Manual Is For

This manual is for:

- Regular users who run scans and review results
- Users who generate and export reports
- Users who manage a subscription or plan
- Admin users who review users, scans, KYC, and verification queues

## 3. First-Time Setup

Before using the platform, make sure:

- You have a valid account
- Your browser allows cookies and JavaScript
- You can reach the frontend and backend services
- The scanner worker is running if your deployment uses a separate worker process

If you are running locally, the usual flow is:

1. Start the backend
2. Start the frontend
3. Start the scanner worker
4. Log in from the web interface

## 4. Logging In and Creating an Account

### Register a new account

Use the registration page to create a new account with your email and password.

### Log in

After registration, use the login page to sign in. Once authenticated, you will have access to protected pages such as:

- Dashboard
- Scanners
- All Scans
- Scan Detail
- Reports
- Subscription
- Vulnerability Scans

### Password and email recovery

The app also includes flows for:

- Forgot password
- Reset password
- Email verification

If you do not verify your account when required, some features may remain unavailable.

## 5. Main Navigation

The exact menu depends on your role, but the main user-facing areas are:

- Dashboard: overview of recent activity and system health
- Scanners: start a new reconnaissance scan
- All Scans: browse scan history
- Reports: generate and export scan reports
- Subscription: view plan usage and billing period
- Vulnerability Scans: run follow-up vulnerability assessments
- Profile: manage personal account details

Admin users also see admin pages for user and scan management.

## 6. Dashboard

The dashboard is your home screen after signing in.

### What you see there

- Total scans completed
- Total subdomains discovered
- System health and worker status
- Queue load and runtime limits
- Current subscription plan
- Most recent scan summary

### How to use it

Use the dashboard to quickly check:

- Whether the scanner system is healthy
- Whether your plan has enough capacity for more scans
- What the latest scan found
- Whether you should jump into the scanner or scan history next

## 7. Starting a New Reconnaissance Scan

Open the Scanners page to start a new scan.

### Basic scan flow

1. Enter a target domain such as `example.com`
2. Start the scan
3. Watch live progress in the feed
4. Review the final results in All Scans or Scan Detail

### Optional authentication inputs

The scanner page also allows optional authenticated scanning inputs:

- Authentication headers
- Authentication cookies

Use these only when you need the scan to access authenticated content. If you paste JSON here, it must be valid JSON.

### What the scan does

A scan can collect:

- Subdomains
- Live hosts
- Web endpoints
- HTTP status and fingerprints
- Open ports
- TLS and certificate information
- Directory exposure findings

### Live scan behavior

While a scan is running, the page can show:

- Current phase
- Live log messages
- Progress counters
- Reconnection and restore state if the browser reloads

If the scan is interrupted, the UI can restore the active scan from local state when possible.

### Canceling a scan

If supported in your deployment, you can cancel a running scan from the scanner interface. After cancellation, the current scan state is cleared from the local session view.

## 8. Scan Results Overview

### All Scans page

The All Scans page gives you a searchable list of your scan history.

You can:

- Search by target domain
- Filter by status
- Open a scan by clicking the row or the view icon

### Common scan statuses

- Pending
- Running
- Completed
- Failed

### When to use it

Use All Scans when you want to:

- Find a past scan quickly
- Compare scan statuses
- Open a specific scan record
- See summary counts for subdomains, endpoints, and alive hosts

## 9. Detailed Scan View

The Scan Detail page is the main place to inspect scan output.

### Summary cards

At the top, you will usually see:

- Scan status
- Number of subdomains
- Number of endpoints
- Number of open ports
- TLS issue count
- Directory issue count

### Tabs inside a scan

#### Subdomains

Shows discovered subdomains and their status.

Typical data includes:

- Subdomain name
- IP addresses
- Alive or error status

#### Endpoints

Shows discovered web endpoints, including:

- URL
- HTTP status code
- Page title
- Detected fingerprints

Use the endpoint filters to narrow results by:

- Search term
- HTTP status class such as 2xx, 3xx, 4xx, or 5xx

#### Open Ports

Shows network findings such as:

- Host
- Port number
- Protocol
- Service name
- Product or banner details

This is useful for identifying exposed services and unexpected network surface.

#### TLS Analysis

Shows TLS and certificate results for hosts that support HTTPS.

You may see:

- TLS version support
- Weak protocol versions
- Certificate validity status
- Expiry-related issues

#### Directories

Shows common directory misconfiguration findings.

Examples include exposed paths such as:

- `.git`
- `.env`
- backup directories
- admin paths
- documentation endpoints
- server status pages

### Running a vulnerability scan from scan detail

If the reconnaissance scan is complete, you may see an action to launch a vulnerability scan from the scan detail page. This is typically used after recon data is available.

## 10. Reporting

The Reports page is where you generate formal output from a completed scan.

### What reports include

- Scan summary and metadata
- Critical findings
- Technology stack breakdown
- Full detailed results
- Export options

### How to use reports

1. Open Reports
2. Select a date range if needed
3. Choose a scan
4. Generate the report
5. Review or download the output

### Export formats

The report UI supports:

- JSON export for machine use
- HTML export for readable reporting
- CSV export for compact sharing in spreadsheets

### When to use reports

Use reports when you need to:

- Share a scan with a client or teammate
- Store evidence of findings
- Create a bug bounty submission
- Document security posture over time

## 11. Subscription Management

The Subscription page shows your current plan, usage, and billing cycle.

### What you can review there

- Current plan name
- Scan usage for the billing period
- Storage usage
- API calls made today
- Billing start and end dates
- Remaining days in the billing period
- Auto-renew status
- Plan compute profile

### Why it matters

This page helps you understand whether you are close to plan limits for:

- Monthly scans
- Storage quota
- API usage
- Concurrent scans

### Plans page

The Plans page is where you can compare available subscription tiers before upgrading.

### Stripe success page

After checkout, the app may redirect to a Stripe success page to confirm the payment flow completed.

## 12. Vulnerability Scans

Revulnera also includes vulnerability scan pages separate from reconnaissance.

Use these when you want to go beyond discovery and assess a target more deeply after recon data has been collected.

### Typical flow

1. Finish reconnaissance
2. Open the vulnerability scan page
3. Start a scan for a completed recon target
4. Review the detailed vulnerability result page

## 13. Domain Verification and Account Verification

Some deployments include verification flows such as:

- Domain verification
- Account verification

These are usually required for plan eligibility, team workflows, or trust checks before some features are enabled.

If a page asks for verification, complete the requested step before trying to run the linked feature again.

## 14. Admin Features

Admin pages are visible only to privileged users.

Typical admin areas include:

- Admin dashboard
- User management
- User detail views
- KYC queue and detail pages
- Domain proof queue and detail pages
- Bug bounty scope management
- Admin scan review
- Analytics

If you are not an admin, these pages will not be accessible.

## 15. Common User Workflow

A typical session looks like this:

1. Log in
2. Check dashboard health and plan status
3. Start a new scan from Scanners
4. Watch live scan progress
5. Open the completed scan in All Scans
6. Inspect subdomains, endpoints, ports, TLS, and directories in Scan Detail
7. Generate a report from Reports
8. Review subscription usage if you are close to limits
9. Run a vulnerability scan if deeper testing is needed

## 16. Best Practices

- Scan only targets you are authorized to test
- Use authenticated scan inputs only when needed
- Review plan limits before starting many scans
- Export reports after major scans so you keep a record
- Check the scan detail page for the most complete evidence
- Use the subscription page to avoid unexpected limits

## 17. Troubleshooting

### I cannot log in

- Check that your email and password are correct
- Verify your account if required
- Reset your password if needed

### A scan does not start

- Make sure you are logged in
- Check that the target domain is valid
- Confirm your plan still allows new scans
- Verify the backend and worker are running

### Live progress is not updating

- Refresh the page and allow it to reconnect
- Confirm WebSocket access is not blocked
- Check backend and worker logs

### A report is empty

- Make sure the scan has completed
- Confirm the scan actually collected data
- Open the scan detail page to check whether results exist

### Subscription data does not load

- Refresh the page
- Confirm the backend is available
- Check whether your session is still authenticated

## 18. Quick Reference

### Main pages

- `/dashboard`
- `/scanners`
- `/scans`
- `/scan/:scanId`
- `/reports`
- `/subscription`
- `/plans`
- `/vulnerability-scans`
- `/profile`

### Admin pages

- `/admin`
- `/admin/users`
- `/admin/kyc`
- `/admin/domain-proofs`
- `/admin/bug-bounty`
- `/admin/scans`
- `/admin/analytics`

## 19. Where to Read More

For deeper technical details, see:

- `docs/REPORTING_GUIDE.md`
- `docs/QUICK_START_REFACTORED.md`
- `docs/NETWORK_ANALYSIS_IMPLEMENTATION.md`
- `docs/REALTIME_STREAMING.md`
- `docs/SUBSCRIPTION.md` if present in your branch or deployment

