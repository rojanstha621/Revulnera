"""Automate a ClickUp workspace for the Revulnera project.

Fill in the ClickUp API token and optional IDs below, then run:

    python scripts/clickup_board_automation.py

What this script does:
- Creates or reuses a ClickUp Space (if TEAM_ID is provided)
- Creates one List per subsystem in top-to-bottom project order
- Creates tasks for each roadmap item with due dates, tags and checklists
- Creates a separate List for Milestones

Placeholders you must fill before running:
- API_KEY or CLICKUP_TOKEN: your ClickUp Personal API Token
- WORKSPACE_ID or TEAM_ID: your ClickUp workspace/team id
- SPACE_ID: existing Space ID to use (optional; script will create a Space under WORKSPACE_ID/TEAM_ID if not provided)

This script is intentionally self-contained and leaves secret placeholders empty.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
import argparse
import os
import sys
import time
from typing import Iterable

import requests


API_KEY = "pk_284651564_D03IQ47PQ35KIQJ2V6Y97AXYN786MT0A"
CLICKUP_TOKEN = ""  # Backward-compatible alias for API_KEY.
WORKSPACE_ID = "90182527694"
TEAM_ID = ""  # Backward-compatible alias for WORKSPACE_ID.
SPACE_ID = "901810474820"  # If provided the script will use this space instead of creating one.
SPACE_NAME = "Revulnera"

BASE_URL = "https://api.clickup.com/api/v2"


@dataclass(frozen=True)
class Task:
    title: str
    start_date: str
    duration_days: int
    story: str
    priority: str = "normal"
    effort: str = "medium"
    done_when: list[str] = field(default_factory=list)
    deliverables: list[str] = field(default_factory=list)
    checklist: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class Subsystem:
    name: str
    tag: str
    tasks: list[Task]


def must_env(name: str, hint: str = "") -> str:
    v = globals().get(name, "") or os.getenv(name)
    if not v:
        raise ValueError(f"{name} must be set before running the script. {hint}")
    return v


def get_api_key() -> str:
    return (
        globals().get("API_KEY", "")
        or globals().get("CLICKUP_TOKEN", "")
        or os.getenv("API_KEY", "")
        or os.getenv("CLICKUP_TOKEN", "")
    )


def get_workspace_id() -> str:
    return (
        globals().get("WORKSPACE_ID", "")
        or globals().get("TEAM_ID", "")
        or os.getenv("WORKSPACE_ID", "")
        or os.getenv("TEAM_ID", "")
    )


def parse_date(date_text: str) -> datetime:
    return datetime.strptime(date_text, "%Y-%m-%d")


def to_millis(dt: datetime) -> int:
    return int(time.mktime(dt.timetuple()) * 1000)


def due_millis(start_date: str, duration_days: int) -> int:
    start = parse_date(start_date)
    due = start + timedelta(days=max(duration_days - 1, 0))
    due = datetime(due.year, due.month, due.day, 17, 0, 0)
    return to_millis(due)


def start_millis(start_date: str) -> int:
    start = parse_date(start_date)
    start = datetime(start.year, start.month, start.day, 9, 0, 0)
    return to_millis(start)


def build_description(subsystem: str, task: Task) -> str:
    start = parse_date(task.start_date)
    due = start + timedelta(days=max(task.duration_days - 1, 0))
    lines = [
        f"User story: {task.story}",
        "",
        f"Subsystem: {subsystem}",
        f"Planned start: {start.strftime('%Y-%m-%d')}",
        f"Planned due: {due.strftime('%Y-%m-%d')}",
        f"Status: Completed",
        f"Completed on: {due.strftime('%Y-%m-%d')}",
        f"Priority: {task.priority}",
        f"Estimated effort: {task.effort}",
        f"Estimated duration: {task.duration_days} days",
        "",
        "Delivery notes:",
    ]
    if task.deliverables:
        for item in task.deliverables:
            lines.append(f"- {item}")
    else:
        lines.append("- Complete the implementation and validation for this task.")

    lines.append("")
    lines.append("Acceptance checklist:")
    if task.checklist:
        for item in task.checklist:
            lines.append(f"- {item}")
    else:
        lines.append("- Verified against project requirements and supporting docs.")

    lines.append("")
    lines.append("Definition of done:")
    if task.done_when:
        for item in task.done_when:
            lines.append(f"- {item}")
    else:
        lines.extend([
            "- Implementation is complete.",
            "- Validation is complete.",
            "- The task is reflected in the final roadmap and project docs.",
        ])

    lines.extend([
        "",
        "Implementation context:",
        "- Aligns with the Revulnera project roadmap and the Gantt chart dates.",
    ])
    return "\n".join(lines)


def cu_request(method: str, path: str, params: dict | None = None, json: dict | None = None) -> dict:
    token = get_api_key().strip()
    if not token:
        raise ValueError("API_KEY or CLICKUP_TOKEN must be set before running the script. Get one at https://app.clickup.com/settings/apps")
    headers = {"Authorization": token, "Content-Type": "application/json"}
    url = f"{BASE_URL}{path}"
    resp = requests.request(method, url, params=params, json=json, headers=headers, timeout=30)
    if resp.status_code >= 400:
        raise RuntimeError(f"ClickUp API error {resp.status_code} for {method} {path}: {resp.text[:400]}")
    try:
        return resp.json()
    except ValueError:
        return {}


def create_space(team_id: str, name: str) -> str:
    body = {"name": name, "multiple_assignees": True}
    res = cu_request("POST", f"/team/{team_id}/space", json=body)
    return res.get("id", "")


def fetch_lists(space_id: str) -> list[dict]:
    res = cu_request("GET", f"/space/{space_id}/list")
    return res.get("lists", [])


def create_or_get_list(space_id: str, name: str) -> str:
    for item in fetch_lists(space_id):
        if item.get("name") == name:
            return item.get("id", "")
    body = {"name": name}
    res = cu_request("POST", f"/space/{space_id}/list", json=body)
    return res.get("id", "")


def fetch_tasks(list_id: str) -> list[dict]:
    res = cu_request("GET", f"/list/{list_id}/task", params={"archived": "false", "subtasks": "false"})
    return res.get("tasks", [])


def update_task(task_id: str, name: str, description: str, start_ms: int, due_ms: int, tags: Iterable[str]) -> str:
    body = {
        "name": name,
        "description": description,
        "start_date": start_ms,
        "due_date": due_ms,
        "status": "complete",
        "tags": list(tags),
    }
    res = cu_request("PUT", f"/task/{task_id}", json=body)
    return res.get("id", "")


def create_task(list_id: str, name: str, description: str, start_ms: int, due_ms: int, tags: Iterable[str]) -> str:
    body = {
        "name": name,
        "description": description,
        "start_date": start_ms,
        "due_date": due_ms,
        "status": "complete",
        "tags": list(tags),
    }
    res = cu_request("POST", f"/list/{list_id}/task", json=body)
    return res.get("id", "")


def create_or_update_task(list_id: str, name: str, description: str, start_ms: int, due_ms: int, tags: Iterable[str]) -> str:
    for item in fetch_tasks(list_id):
        if item.get("name") == name:
            task_id = item.get("id", "")
            if task_id:
                return update_task(task_id, name, description, start_ms, due_ms, tags)
    return create_task(list_id, name, description, start_ms, due_ms, tags)


def create_comment(task_id: str, text: str) -> None:
    cu_request("POST", f"/task/{task_id}/comment", json={"comment_text": text})


def create_checklist(task_id: str, name: str, items: Iterable[str]) -> None:
    existing = cu_request("GET", f"/task/{task_id}")
    for checklist in existing.get("checklists", []):
        if checklist.get("name") == name:
            return
    body = {"name": name}
    res = cu_request("POST", f"/task/{task_id}/checklist", json=body)
    checklist_id = res.get("id", "")
    if not checklist_id:
        return
    for it in items:
        cu_request("POST", f"/task/{task_id}/checklist/{checklist_id}/checklist_item", json={"name": it})


def build_roadmap() -> tuple[list[Subsystem], list[Task]]:
    subsystems = [
        Subsystem(
            name="User Management",
            tag="User Management",
            tasks=[
                Task("Requirement analysis & setup", "2025-11-01", 12, "As a user, I want the project requirements and setup to be defined so that the platform has a clear foundation.", "high", "small", ["Requirements are documented", "Environment is ready", "Dependencies are recorded"], ["Documented scope", "Initial environment setup", "Implementation notes"], ["Confirm project goals", "Validate backend setup", "Record dependencies"]),
                Task("Bootstrap backend & auth foundation", "2025-11-13", 14, "As a user, I want the backend authentication foundation to be ready so that I can securely access the platform.", "high", "medium", ["Auth stack is in place", "Login flow is stable", "Security basics are enforced"], ["Auth structure", "JWT-ready backend skeleton", "Initial security controls"], ["Create auth modules", "Verify project settings", "Prepare API structure"]),
                Task("Custom user model & serializers", "2025-11-27", 12, "As a user, I want a custom user model and serializers so that my account data is handled consistently.", "high", "medium", ["Model is aligned with project needs", "Serializer validation is complete", "Account data is stable"], ["Custom user model", "User serializers", "Validation rules"], ["Support email login", "Add profile fields", "Check serializer outputs"]),
                Task("Register / login API endpoints", "2025-12-09", 18, "As a user, I want register and login APIs so that I can create an account and sign in securely.", "high", "large", ["Registration works", "Login works", "Token flow is stable"], ["Registration endpoint", "Login endpoint", "Auth response payloads"], ["Test token issue", "Validate password rules", "Verify response format"]),
                Task("Frontend auth flow", "2025-12-27", 16, "As a user, I want a frontend authentication flow so that I can register and sign in smoothly.", "medium", "large", ["Forms are connected", "Errors are visible", "Navigation is smooth"], ["Login screen", "Registration screen", "Session handling"], ["Connect forms to APIs", "Display auth errors", "Confirm navigation flow"]),
                Task("Email verification & password reset", "2026-01-12", 14, "As a user, I want email verification and password reset so that my account remains secure and recoverable.", "high", "medium", ["Verification flow works", "Password reset works", "Emails are delivered"], ["Verification flow", "Password reset flow", "Email templates"], ["Send verification link", "Reset password securely", "Test email workflow"]),
                Task("Profile & password management APIs", "2026-01-26", 10, "As a user, I want profile and password management APIs so that I can manage my account information.", "medium", "medium", ["Profile updates work", "Password changes work", "Routes are protected"], ["Profile update API", "Password change API", "Profile validation"], ["Update profile fields", "Enforce password checks", "Protect authenticated routes"]),
                Task("Admin user module & RBAC", "2026-03-01", 14, "As an admin, I want user management and role controls so that I can approve and manage access.", "high", "medium", ["Admin actions are controlled", "Roles are enforced", "Users are manageable"], ["Admin dashboard area", "Role-based permissions", "User control endpoints"], ["Define roles", "Restrict admin routes", "Verify permissions"]),
                Task("Scan approval policy & controls", "2026-03-15", 14, "As an admin, I want scan approval policies and controls so that only approved users can run scans.", "high", "medium", ["Approvals are required", "Policy is enforced", "Actions are auditable"], ["Approval workflow", "Policy rules", "Access checks"], ["Require approval before scans", "Log approval actions", "Test policy enforcement"]),
                Task("KYC upload & review workflow", "2026-03-29", 14, "As an admin, I want a KYC review workflow so that identity verification can be completed before access is granted.", "high", "medium", ["Documents are uploaded", "Reviews are tracked", "Decisions are stored"], ["KYC upload flow", "Review flow", "Approval/rejection handling"], ["Upload documents", "Review KYC submissions", "Store review result"]),
            ],
        ),
        Subsystem(
            name="Setup & Recon",
            tag="Setup & Recon",
            tasks=[
                Task("Subdomain discovery integration", "2025-12-01", 12, "As a user, I want subdomain discovery integrated so that the platform can collect the target attack surface.", "high", "medium", ["Subdomains are discovered", "Results are persisted", "Progress is streamed"], ["Subfinder integration", "Discovery storage", "Progress reporting"], ["Run subdomain enumeration", "Store results", "Stream progress updates"]),
                Task("Endpoint discovery engine", "2025-12-13", 12, "As a user, I want endpoint discovery so that the system can identify live application routes.", "high", "medium", ["Endpoints are discovered", "Routes are deduplicated", "Crawl output is stored"], ["Crawling engine", "Endpoint persistence", "Discovery rules"], ["Discover endpoints", "Deduplicate URLs", "Persist crawl results"]),
                Task("Recon data models & persistence", "2025-12-25", 10, "As a user, I want recon data models and persistence so that scan results are stored reliably.", "high", "medium", ["Schema is stable", "Data is persisted", "Relationships are correct"], ["Scan schema", "Subdomain schema", "Endpoint schema"], ["Apply migrations", "Validate relations", "Confirm storage"]),
                Task("Recon ingestion APIs", "2026-01-04", 10, "As a user, I want recon ingestion APIs so that worker results can be saved into the backend.", "high", "medium", ["Worker payloads are accepted", "Validation is enforced", "Results are saved"], ["Ingestion endpoints", "Validation handling", "JSON payload support"], ["Accept worker payloads", "Validate request data", "Save recon results"]),
                Task("Frontend recon scan pages", "2026-01-14", 14, "As a user, I want recon scan pages so that I can view discovered assets in the frontend.", "medium", "medium", ["Assets are visible", "Real-time updates work", "Scan progress is clear"], ["Recon pages", "Asset tables", "Real-time updates"], ["Render subdomains", "Render endpoints", "Show scan progress"]),
                Task("Subfinder + httpx upgrade", "2026-01-28", 10, "As a user, I want the discovery engine upgraded so that enumeration and probing are faster and more accurate.", "medium", "medium", ["Discovery is faster", "Host probing is better", "Output quality is improved"], ["Improved discovery pipeline", "httpx probing", "Result handling"], ["Upgrade probing logic", "Handle live hosts", "Validate output quality"]),
                Task("Endpoint QA & tech fingerprinting", "2026-02-10", 12, "As a user, I want endpoint QA and fingerprinting so that discovered services are identified correctly.", "medium", "medium", ["Fingerprinting is accurate", "QA is complete", "Services are identified"], ["Fingerprint rules", "QA checks", "Service identification"], ["Confirm technology detection", "Review endpoint accuracy", "Test fingerprint output"]),
            ],
        ),
        Subsystem(
            name="Network & Server Analysis",
            tag="Network & Server Analysis",
            tasks=[
                Task("Network analysis backend models", "2026-01-10", 8, "As a user, I want network analysis models so that port, TLS, and directory findings can be stored.", "high", "small", ["Models are defined", "Indexes are created", "Relations are correct"], ["Port scan model", "TLS result model", "Directory finding model"], ["Create migrations", "Confirm indexes", "Validate foreign keys"]),
                Task("Scanner network modules", "2026-01-18", 10, "As a user, I want network scanner modules so that port, TLS, and directory checks can run automatically.", "high", "medium", ["Modules run automatically", "Checks are safe", "Outputs are ready"], ["Nmap module", "TLS module", "Directory module"], ["Implement scan functions", "Handle host iteration", "Prepare outputs"]),
                Task("TLS analysis checks", "2026-01-28", 10, "As a user, I want TLS checks so that weak versions and certificate issues are detected.", "high", "medium", ["Weak TLS is found", "Certificates are validated", "Issues are flagged"], ["Version detection", "Certificate validation", "TLS issue flags"], ["Detect weak TLS", "Check certificate expiry", "Store findings"]),
                Task("Directory misconfiguration checks", "2026-02-07", 10, "As a user, I want directory checks so that sensitive paths and exposed files are identified.", "high", "medium", ["Sensitive files are detected", "Exposure is recorded", "Evidence is captured"], ["Sensitive path list", "Response analysis", "Misconfiguration findings"], ["Probe common paths", "Detect exposure", "Record evidence"]),
                Task("Nmap scanning pipeline", "2026-02-17", 12, "As a user, I want an Nmap pipeline so that open ports and service details are collected efficiently.", "high", "large", ["Open ports are detected", "Services are identified", "Results are chunked"], ["Port scanning flow", "Service detection", "Chunked ingestion"], ["Run safe scans", "Capture service banners", "Post results in chunks"]),
                Task("Scanner / vuln decoupling refactor", "2026-03-01", 10, "As a user, I want the scanner and vulnerability modules decoupled so that the system is easier to maintain.", "medium", "medium", ["Modules are separated", "Flow is easier to maintain", "Integration is cleaner"], ["Refactored flow", "Separated responsibilities", "Cleaner interfaces"], ["Split execution paths", "Reduce coupling", "Test integration boundaries"]),
                Task("Go-Django concurrency pipeline", "2026-03-11", 12, "As a user, I want a concurrent Go-to-Django pipeline so that network results are processed quickly.", "high", "large", ["Workers run concurrently", "Uploads are safe", "Streaming remains responsive"], ["Concurrent workers", "Webhook/API posts", "Streaming handling"], ["Validate concurrent uploads", "Avoid blocking scans", "Handle retries"]),
                Task("Concurrency validation & stabilization", "2026-03-23", 10, "As a user, I want concurrency validation so that the network analysis pipeline remains stable under load.", "high", "medium", ["Load behavior is verified", "Timeouts are safe", "Workers are stable"], ["Stress validation", "Timeout handling", "Stabilized worker flow"], ["Run load checks", "Confirm failure recovery", "Review logs"]),
            ],
        ),
        Subsystem(
            name="OWASP Vuln Detection",
            tag="OWASP Vuln Detection",
            tasks=[
                Task("Vuln app foundation & OWASP schema", "2026-02-05", 10, "As a user, I want a vulnerability detection foundation so that OWASP testing can be organized consistently.", "high", "medium", ["Foundation is ready", "Schema is consistent", "Flow is organized"], ["Vulnerability app setup", "OWASP schema", "Base data flow"], ["Create app skeleton", "Define vulnerability schema", "Prepare orchestration flow"]),
                Task("A01 Broken Access Control engine", "2026-02-15", 10, "As a user, I want a Broken Access Control engine so that authorization weaknesses can be detected.", "high", "medium", ["Authorization gaps are found", "Results are scored", "Findings are stored"], ["BAC tests", "Result parsing", "Severity scoring"], ["Implement tests", "Confirm detections", "Store findings"]),
                Task("A02 Cryptographic Failures engine", "2026-02-25", 10, "As a user, I want a cryptographic failures engine so that weak or insecure crypto patterns are detected.", "high", "medium", ["Crypto weaknesses are identified", "Issues are classified", "Outputs are reported"], ["Crypto checks", "Issue classification", "Report output"], ["Check TLS/security patterns", "Record issues", "Validate output"]),
                Task("A03 Injection engine", "2026-03-07", 10, "As a user, I want an injection engine so that common injection risks can be identified.", "high", "medium", ["Injection vectors are tested", "Evidence is captured", "Results are stored"], ["Injection tests", "Payload handling", "Evidence capture"], ["Run injection checks", "Confirm safe testing", "Save results"]),
                Task("A04 Insecure Design engine", "2026-03-17", 10, "As a user, I want an insecure design engine so that architectural security issues can be surfaced.", "medium", "medium", ["Design weaknesses are visible", "Risk is assessed", "Rules are defined"], ["Design checks", "Risk assessment", "Detection rules"], ["Review patterns", "Store outcomes", "Verify severity"]),
                Task("A05 Security Misconfiguration engine", "2026-03-27", 10, "As a user, I want a security misconfiguration engine so that default or weak settings are detected.", "high", "medium", ["Config gaps are detected", "Evidence is captured", "Misconfigurations are reported"], ["Config checks", "Misconfiguration rules", "Result reporting"], ["Run configuration tests", "Capture evidence", "Validate findings"]),
                Task("A06 Vulnerable Components engine", "2026-04-06", 10, "As a user, I want a vulnerable components engine so that outdated dependencies are identified.", "high", "medium", ["Outdated components are found", "Risk is mapped", "Outputs are stored"], ["Component checks", "Version analysis", "Risk mapping"], ["Detect outdated components", "Map to risk", "Store output"]),
                Task("A07 Auth Failures engine", "2026-04-16", 8, "As a user, I want an authentication failures engine so that login and session weaknesses are detected.", "high", "small", ["Auth weaknesses are found", "Sessions are checked", "Failures are recorded"], ["Auth tests", "Session checks", "Failure evidence"], ["Test auth controls", "Capture failures", "Verify results"]),
                Task("A08 Integrity Failures engine", "2026-04-24", 8, "As a user, I want an integrity failures engine so that data integrity weaknesses are surfaced.", "medium", "small", ["Integrity issues are surfaced", "Tampering is checked", "Results are reported"], ["Integrity checks", "Tamper detection", "Issue reporting"], ["Test integrity assumptions", "Record findings", "Confirm output"]),
                Task("A09 Logging & Monitoring engine", "2026-05-02", 8, "As a user, I want a logging and monitoring engine so that security event visibility can be assessed.", "medium", "small", ["Logging is reviewed", "Monitoring gaps are noted", "Risk is summarized"], ["Logging checks", "Monitoring gaps", "Risk summary"], ["Review logging coverage", "Check alerting gaps", "Store findings"]),
                Task("A10 SSRF engine", "2026-05-10", 8, "As a user, I want an SSRF engine so that server-side request forgery risks can be detected.", "high", "medium", ["SSRF risk is tested", "Targets are validated", "Evidence is captured"], ["SSRF tests", "Target validation", "Evidence capture"], ["Run SSRF checks", "Verify safety", "Record detections"]),
                Task("Scan orchestrator", "2026-05-18", 10, "As a user, I want a scan orchestrator so that all vulnerability tests run in sequence.", "high", "medium", ["Execution is controlled", "Tasks are sequenced", "Results are aggregated"], ["Execution flow", "Task sequencing", "Result aggregation"], ["Coordinate modules", "Handle retries", "Aggregate outcomes"]),
                Task("BAC depth hardening", "2026-05-28", 8, "As a user, I want deeper Broken Access Control hardening so that edge cases are covered.", "high", "small", ["BAC coverage is expanded", "Edge cases are covered", "Regression checks pass"], ["Expanded BAC coverage", "Hardening improvements", "Regression checks"], ["Improve test depth", "Validate edge cases", "Re-run findings"]),
                Task("Vuln findings & reporting integration", "2026-06-05", 12, "As a user, I want vulnerability findings integrated with reporting so that results are visible in the final reports.", "high", "medium", ["Findings are linked", "Reports are updated", "Final output is visible"], ["Reporting integration", "Finding linkage", "Final output consolidation"], ["Connect findings to reports", "Check report output", "Verify final persistence"]),
            ],
        ),
        Subsystem(
            name="Reporting & UI",
            tag="Reporting & UI",
            tasks=[
                Task("Admin analytics & management screens", "2026-01-05", 14, "As a user, I want admin analytics and management screens so that I can oversee project activity.", "medium", "medium", ["Analytics are visible", "Management is easy", "Summary widgets work"], ["Admin analytics page", "Management views", "Summary widgets"], ["Build admin panels", "Add metrics", "Review usability"]),
                Task("Scanner dashboard UX refresh", "2026-01-19", 12, "As a user, I want the scanner dashboard refreshed so that scan progress is easier to follow.", "medium", "medium", ["Dashboard is updated", "Progress is visible", "Layout is cleaner"], ["Updated dashboard", "Status cards", "Cleaner layout"], ["Refresh UI components", "Improve readability", "Test live updates"]),
                Task("Recon reporting API suite", "2026-02-15", 12, "As a user, I want a recon reporting API suite so that reports can be generated from scan results.", "high", "medium", ["Report data is available", "JSON output is complete", "Permissions are enforced"], ["Report APIs", "Summary payloads", "Export-ready data"], ["Expose report endpoints", "Validate permissions", "Confirm JSON output"]),
                Task("Approval indicators & controls in UI", "2026-02-27", 10, "As a user, I want approval indicators and controls in the UI so that approval status is visible.", "medium", "small", ["Approval state is visible", "Controls are linked", "Status is clear"], ["Approval badges", "Control buttons", "Status indicators"], ["Display approval state", "Link controls to actions", "Check visibility rules"]),
                Task("Vulnerability reporting screens", "2026-03-20", 12, "As a user, I want vulnerability reporting screens so that findings are displayed clearly.", "high", "medium", ["Findings are clear", "Summaries are visible", "Screens are responsive"], ["Vulnerability report page", "Finding panels", "Severity display"], ["Render findings", "Show summary data", "Test responsiveness"]),
                Task("Loader & final UI polish pass", "2026-04-01", 8, "As a user, I want the final UI polished so that the application feels complete and consistent.", "medium", "small", ["Visual polish is complete", "Loading states are improved", "Final issues are fixed"], ["Final visual polish", "Loading states", "Consistency fixes"], ["Check layout stability", "Improve loading states", "Fix final issues"]),
            ],
        ),
    ]

    milestones = [
        Task("User Management complete", "2025-12-20", 1, "As a user, I want the user management subsystem complete so that authentication and account flows are ready."),
        Task("Recon complete", "2026-01-25", 1, "As a user, I want recon complete so that asset discovery is fully available."),
        Task("Network analysis complete", "2026-02-28", 1, "As a user, I want network analysis complete so that port, TLS, and directory findings are ready."),
        Task("OWASP vuln detection complete", "2026-04-20", 1, "As a user, I want OWASP vulnerability detection complete so that the testing suite is fully available."),
        Task("Final reporting/UI complete", "2026-04-30", 1, "As a user, I want reporting and UI complete so that the project is ready for presentation."),
    ]

    return subsystems, milestones


def run() -> None:
    subsystems, milestones = build_roadmap()

    space_id = SPACE_ID.strip() or ""
    if not space_id:
        team_id = get_workspace_id().strip()
        if not team_id:
            raise ValueError("WORKSPACE_ID or TEAM_ID must be set before running the script, or provide SPACE_ID.")
        space_id = create_space(team_id, SPACE_NAME)

    list_ids: dict[str, str] = {}
    for subsystem in subsystems:
        list_ids[subsystem.name] = create_or_get_list(space_id, subsystem.name)

    milestone_list_id = create_or_get_list(space_id, "Milestones")

    for subsystem in subsystems:
        for task in subsystem.tasks:
            start = start_millis(task.start_date)
            due = due_millis(task.start_date, task.duration_days)
            task_id = create_or_update_task(
                list_ids[subsystem.name],
                task.title,
                build_description(subsystem.name, task),
                start,
                due,
                [subsystem.tag],
            )
            if task.checklist:
                create_checklist(task_id, "Acceptance checklist", task.checklist)
            create_comment(task_id, build_description(subsystem.name, task))

    for m in milestones:
        start = start_millis(m.start_date)
        due = due_millis(m.start_date, m.duration_days)
        t_id = create_or_update_task(milestone_list_id, m.title, build_description("Milestones", m), start, due, ["Milestone"])
        create_checklist(t_id, "Milestone checklist", ["Treat this as a delivery milestone."])
        create_comment(t_id, build_description("Milestones", m))

    print(f"ClickUp roadmap created/updated in space: {space_id}")


def inspect_clickup() -> None:
    if SPACE_ID.strip():
        res = cu_request("GET", f"/space/{SPACE_ID}/list")
        print("Lists in space:")
        for l in res.get("lists", []):
            print(f"- {l.get('name')} (id={l.get('id')})")
        return

    team_id = get_workspace_id().strip()
    if not team_id:
        print("No WORKSPACE_ID/TEAM_ID or SPACE_ID configured. Use --inspect with WORKSPACE_ID or set SPACE_ID.")
        return
    res = cu_request("GET", f"/team/{team_id}/space")
    print("Spaces:")
    for s in res.get("spaces", []):
        print(f"- {s.get('name')} (id={s.get('id')})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Automate the Revulnera ClickUp workspace")
    parser.add_argument("--inspect", action="store_true", help="Show spaces or lists and exit")
    args = parser.parse_args()
    if args.inspect:
        inspect_clickup()
        return
    run()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
