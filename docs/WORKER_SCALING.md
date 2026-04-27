# Worker Scaling Guide

This system uses queue segmentation for fairness:
- premium
- standard
- free

Run dedicated workers per tier in production:

```bash
celery -A vuln_scanner worker -Q premium --concurrency=10
celery -A vuln_scanner worker -Q standard --concurrency=6
celery -A vuln_scanner worker -Q free --concurrency=3
```

Observability endpoints:
- GET /api/system/health/
- GET /api/system/metrics/

The metrics endpoint exposes:
- active_tasks
- queued_tasks
- failed_tasks
- workers
- worker_concurrency
- queue_sizes
- per_user_usage
