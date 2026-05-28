"""Automate a Trello board for the Revulnera project.

Fill in the Trello API credentials and optional board identifiers below, then run:

    python scripts/trello_board_automation.py

What this script does:
- Creates or reuses a Trello board
- Creates one list per subsystem in top-to-bottom project order
- Creates milestone cards in a final Milestones list
- Applies labels, due dates, checklist items, and rich user-story descriptions

The task dates are based on the Gantt chart we drafted for the project.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Iterable

import requests


TRELLO_KEY = ""
TRELLO_TOKEN = ""

# Leave BOARD_ID empty to create a fresh board; otherwise the script will reuse it.
BOARD_ID = ""
BOARD_NAME = "Revulnera Project Roadmap"

# Optional workspace/org id for board creation. Leave empty if not needed.
WORKSPACE_ID = ""


BASE_URL = "https://api.trello.com/1"


@dataclass(frozen=True)
class Task:
    title: str
    start_date: str
    duration_days: int
    story: str
    deliverables: list[str] = field(default_factory=list)
    checklist: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class Subsystem:
    name: str
    label_color: str
    tasks: list[Task]


def must(value: str, field_name: str) -> str:
    if not value.strip():
        raise ValueError(f"{field_name} is empty. Fill it before running the script.")
    return value.strip()


def parse_date(date_text: str) -> datetime:
    return datetime.strptime(date_text, "%Y-%m-%d")


def format_due(start_date: str, duration_days: int) -> str:
    start = parse_date(start_date)
    due = start + timedelta(days=max(duration_days - 1, 0))
    return due.strftime("%Y-%m-%dT17:00:00.000Z")


def build_description(subsystem: str, task: Task) -> str:
    start = parse_date(task.start_date)
    due = start + timedelta(days=max(task.duration_days - 1, 0))

    lines = [
        f"User story: {task.story}",
        "",
        f"Subsystem: {subsystem}",
        f"Planned start: {start.strftime('%Y-%m-%d')}",
        f"Planned due: {due.strftime('%Y-%m-%d')}",
        f"Estimated duration: {task.duration_days} days",
        "",
        "Delivery notes:",
    ]

    if task.deliverables:
        for item in task.deliverables:
            lines.append(f"- {item}")
    else:
        lines.append("- Complete the implementation and validation for this task.")

    lines.extend([
        "",
        "Acceptance checklist:",
    ])

    if task.checklist:
        for item in task.checklist:
            lines.append(f"- {item}")
    else:
        lines.append("- Verified against project requirements and supporting docs.")

    lines.extend([
        "",
        "Implementation context:",
        "- Aligns with the Revulnera project roadmap and the Gantt chart dates.",
        "- Keep the task top-to-bottom order inside the Trello board.",
    ])

    return "\n".join(lines)


def request(method: str, path: str, params: dict | None = None, json: dict | None = None) -> dict:
    auth_params = {"key": must(TRELLO_KEY, "TRELLO_KEY"), "token": must(TRELLO_TOKEN, "TRELLO_TOKEN")}
    merged = {**auth_params, **(params or {})}
    response = requests.request(method, f"{BASE_URL}{path}", params=merged, json=json, timeout=30)
    response.raise_for_status()
    return response.json()


def create_board() -> str:
    payload = {"name": BOARD_NAME, "defaultLists": "false"}
    if WORKSPACE_ID.strip():
        payload["idOrganization"] = WORKSPACE_ID.strip()
    board = request("POST", "/boards/", params=payload)
    return board["id"]


def create_list(board_id: str, name: str) -> str:
    result = request("POST", f"/boards/{board_id}/lists", params={"name": name})
    return result["id"]


def create_label(board_id: str, name: str, color: str) -> str:
    result = request(
        "POST",
        "/labels",
        params={"idBoard": board_id, "name": name, "color": color},
    )
    return result["id"]


def create_card(list_id: str, name: str, description: str, due: str, label_ids: Iterable[str]) -> str:
    params = {
        "idList": list_id,
        "name": name,
        "desc": description,
        "due": due,
        "dueComplete": "false",
        "idLabels": ",".join(label_ids),
    }
    result = request("POST", "/cards", params=params)
    return result["id"]


def add_checklist(card_id: str, checklist_items: Iterable[str]) -> None:
    items = [item.strip() for item in checklist_items if item.strip()]
    if not items:
        return

    checklist = request("POST", "/checklists", params={"idCard": card_id, "name": "Task Checklist"})
    checklist_id = checklist["id"]
    for item in items:
        request("POST", f"/checklists/{checklist_id}/checkItems", params={"name": item})


def build_roadmap() -> tuple[list[Subsystem], list[Task]]:
    subsystems = [
        Subsystem(
            name="User Management",
            label_color="green",
            tasks=[
                Task(
                    title="Requirement analysis & setup",
                    start_date="2025-11-01",
                    duration_days=12,
                    story="As a user, I want the project requirements and setup to be defined so that the platform has a clear foundation.",
                    deliverables=["Documented scope", "Initial environment setup", "Implementation notes"],
                    checklist=["Confirm project goals", "Validate backend setup", "Record dependencies"],
                ),
                Task(
                    title="Bootstrap backend & auth foundation",
                    start_date="2025-11-13",
                    duration_days=14,
                    story="As a user, I want the backend authentication foundation to be ready so that I can securely access the platform.",
                    deliverables=["Auth structure", "JWT-ready backend skeleton", "Initial security controls"],
                    checklist=["Create auth modules", "Verify project settings", "Prepare API structure"],
                ),
                Task(
                    title="Custom user model & serializers",
                    start_date="2025-11-27",
                    duration_days=12,
                    story="As a user, I want a custom user model and serializers so that my account data is handled consistently.",
                    deliverables=["Custom user model", "User serializers", "Validation rules"],
                    checklist=["Support email login", "Add profile fields", "Check serializer outputs"],
                ),
                Task(
                    title="Register / login API endpoints",
                    start_date="2025-12-09",
                    duration_days=18,
                    story="As a user, I want register and login APIs so that I can create an account and sign in securely.",
                    deliverables=["Registration endpoint", "Login endpoint", "Auth response payloads"],
                    checklist=["Test token issue", "Validate password rules", "Verify response format"],
                ),
                Task(
                    title="Frontend auth flow",
                    start_date="2025-12-27",
                    duration_days=16,
                    story="As a user, I want a frontend authentication flow so that I can register and sign in smoothly.",
                    deliverables=["Login screen", "Registration screen", "Session handling"],
                    checklist=["Connect forms to APIs", "Display auth errors", "Confirm navigation flow"],
                ),
                Task(
                    title="Email verification & password reset",
                    start_date="2026-01-12",
                    duration_days=14,
                    story="As a user, I want email verification and password reset so that my account remains secure and recoverable.",
                    deliverables=["Verification flow", "Password reset flow", "Email templates"],
                    checklist=["Send verification link", "Reset password securely", "Test email workflow"],
                ),
                Task(
                    title="Profile & password management APIs",
                    start_date="2026-01-26",
                    duration_days=10,
                    story="As a user, I want profile and password management APIs so that I can manage my account information.",
                    deliverables=["Profile update API", "Password change API", "Profile validation"],
                    checklist=["Update profile fields", "Enforce password checks", "Protect authenticated routes"],
                ),
                Task(
                    title="Admin user module & RBAC",
                    start_date="2026-03-01",
                    duration_days=14,
                    story="As an admin, I want user management and role controls so that I can approve and manage access.",
                    deliverables=["Admin dashboard area", "Role-based permissions", "User control endpoints"],
                    checklist=["Define roles", "Restrict admin routes", "Verify permissions"],
                ),
                Task(
                    title="Scan approval policy & controls",
                    start_date="2026-03-15",
                    duration_days=14,
                    story="As an admin, I want scan approval policies and controls so that only approved users can run scans.",
                    deliverables=["Approval workflow", "Policy rules", "Access checks"],
                    checklist=["Require approval before scans", "Log approval actions", "Test policy enforcement"],
                ),
                Task(
                    title="KYC upload & review workflow",
                    start_date="2026-03-29",
                    duration_days=14,
                    story="As an admin, I want a KYC review workflow so that identity verification can be completed before access is granted.",
                    deliverables=["KYC upload flow", "Review flow", "Approval/rejection handling"],
                    checklist=["Upload documents", "Review KYC submissions", "Store review result"],
                ),
            ],
        ),
        Subsystem(
            name="Setup & Recon",
            label_color="blue",
            tasks=[
                Task(
                    title="Subdomain discovery integration",
                    start_date="2025-12-01",
                    duration_days=12,
                    story="As a user, I want subdomain discovery integrated so that the platform can collect the target attack surface.",
                    deliverables=["Subfinder integration", "Discovery storage", "Progress reporting"],
                    checklist=["Run subdomain enumeration", "Store results", "Stream progress updates"],
                ),
                Task(
                    title="Endpoint discovery engine",
                    start_date="2025-12-13",
                    duration_days=12,
                    story="As a user, I want endpoint discovery so that the system can identify live application routes.",
                    deliverables=["Crawling engine", "Endpoint persistence", "Discovery rules"],
                    checklist=["Discover endpoints", "Deduplicate URLs", "Persist crawl results"],
                ),
                Task(
                    title="Recon data models & persistence",
                    start_date="2025-12-25",
                    duration_days=10,
                    story="As a user, I want recon data models and persistence so that scan results are stored reliably.",
                    deliverables=["Scan schema", "Subdomain schema", "Endpoint schema"],
                    checklist=["Apply migrations", "Validate relations", "Confirm storage"],
                ),
                Task(
                    title="Recon ingestion APIs",
                    start_date="2026-01-04",
                    duration_days=10,
                    story="As a user, I want recon ingestion APIs so that worker results can be saved into the backend.",
                    deliverables=["Ingestion endpoints", "Validation handling", "JSON payload support"],
                    checklist=["Accept worker payloads", "Validate request data", "Save recon results"],
                ),
                Task(
                    title="Frontend recon scan pages",
                    start_date="2026-01-14",
                    duration_days=14,
                    story="As a user, I want recon scan pages so that I can view discovered assets in the frontend.",
                    deliverables=["Recon pages", "Asset tables", "Real-time updates"],
                    checklist=["Render subdomains", "Render endpoints", "Show scan progress"],
                ),
                Task(
                    title="Subfinder + httpx upgrade",
                    start_date="2026-01-28",
                    duration_days=10,
                    story="As a user, I want the discovery engine upgraded so that enumeration and probing are faster and more accurate.",
                    deliverables=["Improved discovery pipeline", "httpx probing", "Result handling"],
                    checklist=["Upgrade probing logic", "Handle live hosts", "Validate output quality"],
                ),
                Task(
                    title="Endpoint QA & tech fingerprinting",
                    start_date="2026-02-10",
                    duration_days=12,
                    story="As a user, I want endpoint QA and fingerprinting so that discovered services are identified correctly.",
                    deliverables=["Fingerprint rules", "QA checks", "Service identification"],
                    checklist=["Confirm technology detection", "Review endpoint accuracy", "Test fingerprint output"],
                ),
            ],
        ),
        Subsystem(
            name="Network & Server Analysis",
            label_color="orange",
            tasks=[
                Task(
                    title="Network analysis backend models",
                    start_date="2026-01-10",
                    duration_days=8,
                    story="As a user, I want network analysis models so that port, TLS, and directory findings can be stored.",
                    deliverables=["Port scan model", "TLS result model", "Directory finding model"],
                    checklist=["Create migrations", "Confirm indexes", "Validate foreign keys"],
                ),
                Task(
                    title="Scanner network modules",
                    start_date="2026-01-18",
                    duration_days=10,
                    story="As a user, I want network scanner modules so that port, TLS, and directory checks can run automatically.",
                    deliverables=["Nmap module", "TLS module", "Directory module"],
                    checklist=["Implement scan functions", "Handle host iteration", "Prepare outputs"],
                ),
                Task(
                    title="TLS analysis checks",
                    start_date="2026-01-28",
                    duration_days=10,
                    story="As a user, I want TLS checks so that weak versions and certificate issues are detected.",
                    deliverables=["Version detection", "Certificate validation", "TLS issue flags"],
                    checklist=["Detect weak TLS", "Check certificate expiry", "Store findings"],
                ),
                Task(
                    title="Directory misconfiguration checks",
                    start_date="2026-02-07",
                    duration_days=10,
                    story="As a user, I want directory checks so that sensitive paths and exposed files are identified.",
                    deliverables=["Sensitive path list", "Response analysis", "Misconfiguration findings"],
                    checklist=["Probe common paths", "Detect exposure", "Record evidence"],
                ),
                Task(
                    title="Nmap scanning pipeline",
                    start_date="2026-02-17",
                    duration_days=12,
                    story="As a user, I want an Nmap pipeline so that open ports and service details are collected efficiently.",
                    deliverables=["Port scanning flow", "Service detection", "Chunked ingestion"],
                    checklist=["Run safe scans", "Capture service banners", "Post results in chunks"],
                ),
                Task(
                    title="Scanner / vuln decoupling refactor",
                    start_date="2026-03-01",
                    duration_days=10,
                    story="As a user, I want the scanner and vulnerability modules decoupled so that the system is easier to maintain.",
                    deliverables=["Refactored flow", "Separated responsibilities", "Cleaner interfaces"],
                    checklist=["Split execution paths", "Reduce coupling", "Test integration boundaries"],
                ),
                Task(
                    title="Go-Django concurrency pipeline",
                    start_date="2026-03-11",
                    duration_days=12,
                    story="As a user, I want a concurrent Go-to-Django pipeline so that network results are processed quickly.",
                    deliverables=["Concurrent workers", "Webhook/API posts", "Streaming handling"],
                    checklist=["Validate concurrent uploads", "Avoid blocking scans", "Handle retries"],
                ),
                Task(
                    title="Concurrency validation & stabilization",
                    start_date="2026-03-23",
                    duration_days=10,
                    story="As a user, I want concurrency validation so that the network analysis pipeline remains stable under load.",
                    deliverables=["Stress validation", "Timeout handling", "Stabilized worker flow"],
                    checklist=["Run load checks", "Confirm failure recovery", "Review logs"],
                ),
            ],
        ),
        Subsystem(
            name="OWASP Vuln Detection",
            label_color="red",
            tasks=[
                Task(
                    title="Vuln app foundation & OWASP schema",
                    start_date="2026-02-05",
                    duration_days=10,
                    story="As a user, I want a vulnerability detection foundation so that OWASP testing can be organized consistently.",
                    deliverables=["Vulnerability app setup", "OWASP schema", "Base data flow"],
                    checklist=["Create app skeleton", "Define vulnerability schema", "Prepare orchestration flow"],
                ),
                Task(
                    title="A01 Broken Access Control engine",
                    start_date="2026-02-15",
                    duration_days=10,
                    story="As a user, I want a Broken Access Control engine so that authorization weaknesses can be detected.",
                    deliverables=["BAC tests", "Result parsing", "Severity scoring"],
                    checklist=["Implement tests", "Confirm detections", "Store findings"],
                ),
                Task(
                    title="A02 Cryptographic Failures engine",
                    start_date="2026-02-25",
                    duration_days=10,
                    story="As a user, I want a cryptographic failures engine so that weak or insecure crypto patterns are detected.",
                    deliverables=["Crypto checks", "Issue classification", "Report output"],
                    checklist=["Check TLS/security patterns", "Record issues", "Validate output"],
                ),
                Task(
                    title="A03 Injection engine",
                    start_date="2026-03-07",
                    duration_days=10,
                    story="As a user, I want an injection engine so that common injection risks can be identified.",
                    deliverables=["Injection tests", "Payload handling", "Evidence capture"],
                    checklist=["Run injection checks", "Confirm safe testing", "Save results"],
                ),
                Task(
                    title="A04 Insecure Design engine",
                    start_date="2026-03-17",
                    duration_days=10,
                    story="As a user, I want an insecure design engine so that architectural security issues can be surfaced.",
                    deliverables=["Design checks", "Risk assessment", "Detection rules"],
                    checklist=["Review patterns", "Store outcomes", "Verify severity"],
                ),
                Task(
                    title="A05 Security Misconfiguration engine",
                    start_date="2026-03-27",
                    duration_days=10,
                    story="As a user, I want a security misconfiguration engine so that default or weak settings are detected.",
                    deliverables=["Config checks", "Misconfiguration rules", "Result reporting"],
                    checklist=["Run configuration tests", "Capture evidence", "Validate findings"],
                ),
                Task(
                    title="A06 Vulnerable Components engine",
                    start_date="2026-04-06",
                    duration_days=10,
                    story="As a user, I want a vulnerable components engine so that outdated dependencies are identified.",
                    deliverables=["Component checks", "Version analysis", "Risk mapping"],
                    checklist=["Detect outdated components", "Map to risk", "Store output"],
                ),
                Task(
                    title="A07 Auth Failures engine",
                    start_date="2026-04-16",
                    duration_days=8,
                    story="As a user, I want an authentication failures engine so that login and session weaknesses are detected.",
                    deliverables=["Auth tests", "Session checks", "Failure evidence"],
                    checklist=["Test auth controls", "Capture failures", "Verify results"],
                ),
                Task(
                    title="A08 Integrity Failures engine",
                    start_date="2026-04-24",
                    duration_days=8,
                    story="As a user, I want an integrity failures engine so that data integrity weaknesses are surfaced.",
                    deliverables=["Integrity checks", "Tamper detection", "Issue reporting"],
                    checklist=["Test integrity assumptions", "Record findings", "Confirm output"],
                ),
                Task(
                    title="A09 Logging & Monitoring engine",
                    start_date="2026-05-02",
                    duration_days=8,
                    story="As a user, I want a logging and monitoring engine so that security event visibility can be assessed.",
                    deliverables=["Logging checks", "Monitoring gaps", "Risk summary"],
                    checklist=["Review logging coverage", "Check alerting gaps", "Store findings"],
                ),
                Task(
                    title="A10 SSRF engine",
                    start_date="2026-05-10",
                    duration_days=8,
                    story="As a user, I want an SSRF engine so that server-side request forgery risks can be detected.",
                    deliverables=["SSRF tests", "Target validation", "Evidence capture"],
                    checklist=["Run SSRF checks", "Verify safety", "Record detections"],
                ),
                Task(
                    title="Scan orchestrator",
                    start_date="2026-05-18",
                    duration_days=10,
                    story="As a user, I want a scan orchestrator so that all vulnerability tests run in sequence.",
                    deliverables=["Execution flow", "Task sequencing", "Result aggregation"],
                    checklist=["Coordinate modules", "Handle retries", "Aggregate outcomes"],
                ),
                Task(
                    title="BAC depth hardening",
                    start_date="2026-05-28",
                    duration_days=8,
                    story="As a user, I want deeper Broken Access Control hardening so that edge cases are covered.",
                    deliverables=["Expanded BAC coverage", "Hardening improvements", "Regression checks"],
                    checklist=["Improve test depth", "Validate edge cases", "Re-run findings"],
                ),
                Task(
                    title="Vuln findings & reporting integration",
                    start_date="2026-06-05",
                    duration_days=12,
                    story="As a user, I want vulnerability findings integrated with reporting so that results are visible in the final reports.",
                    deliverables=["Reporting integration", "Finding linkage", "Final output consolidation"],
                    checklist=["Connect findings to reports", "Check report output", "Verify final persistence"],
                ),
            ],
        ),
        Subsystem(
            name="Reporting & UI",
            label_color="purple",
            tasks=[
                Task(
                    title="Admin analytics & management screens",
                    start_date="2026-01-05",
                    duration_days=14,
                    story="As a user, I want admin analytics and management screens so that I can oversee project activity.",
                    deliverables=["Admin analytics page", "Management views", "Summary widgets"],
                    checklist=["Build admin panels", "Add metrics", "Review usability"],
                ),
                Task(
                    title="Scanner dashboard UX refresh",
                    start_date="2026-01-19",
                    duration_days=12,
                    story="As a user, I want the scanner dashboard refreshed so that scan progress is easier to follow.",
                    deliverables=["Updated dashboard", "Status cards", "Cleaner layout"],
                    checklist=["Refresh UI components", "Improve readability", "Test live updates"],
                ),
                Task(
                    title="Recon reporting API suite",
                    start_date="2026-02-15",
                    duration_days=12,
                    story="As a user, I want a recon reporting API suite so that reports can be generated from scan results.",
                    deliverables=["Report APIs", "Summary payloads", "Export-ready data"],
                    checklist=["Expose report endpoints", "Validate permissions", "Confirm JSON output"],
                ),
                Task(
                    title="Approval indicators & controls in UI",
                    start_date="2026-02-27",
                    duration_days=10,
                    story="As a user, I want approval indicators and controls in the UI so that approval status is visible.",
                    deliverables=["Approval badges", "Control buttons", "Status indicators"],
                    checklist=["Display approval state", "Link controls to actions", "Check visibility rules"],
                ),
                Task(
                    title="Vulnerability reporting screens",
                    start_date="2026-03-20",
                    duration_days=12,
                    story="As a user, I want vulnerability reporting screens so that findings are displayed clearly.",
                    deliverables=["Vulnerability report page", "Finding panels", "Severity display"],
                    checklist=["Render findings", "Show summary data", "Test responsiveness"],
                ),
                Task(
                    title="Loader & final UI polish pass",
                    start_date="2026-04-01",
                    duration_days=8,
                    story="As a user, I want the final UI polished so that the application feels complete and consistent.",
                    deliverables=["Final visual polish", "Loading states", "Consistency fixes"],
                    checklist=["Check layout stability", "Improve loading states", "Fix final issues"],
                ),
            ],
        ),
    ]

    milestones = [
        Task(
            title="User Management complete",
            start_date="2025-12-20",
            duration_days=1,
            story="As a user, I want the user management subsystem complete so that authentication and account flows are ready.",
        ),
        Task(
            title="Recon complete",
            start_date="2026-01-25",
            duration_days=1,
            story="As a user, I want recon complete so that asset discovery is fully available.",
        ),
        Task(
            title="Network analysis complete",
            start_date="2026-02-28",
            duration_days=1,
            story="As a user, I want network analysis complete so that port, TLS, and directory findings are ready.",
        ),
        Task(
            title="OWASP vuln detection complete",
            start_date="2026-04-20",
            duration_days=1,
            story="As a user, I want OWASP vulnerability detection complete so that the testing suite is fully available.",
        ),
        Task(
            title="Final reporting/UI complete",
            start_date="2026-04-30",
            duration_days=1,
            story="As a user, I want reporting and UI complete so that the project is ready for presentation.",
        ),
    ]

    return subsystems, milestones


def run() -> None:
    subsystems, milestones = build_roadmap()

    board_id = BOARD_ID.strip() or create_board()

    label_ids = {
        subsystem.name: create_label(board_id, subsystem.name, subsystem.label_color)
        for subsystem in subsystems
    }
    label_ids["Milestone"] = create_label(board_id, "Milestone", "black")

    list_ids: dict[str, str] = {}
    for subsystem in subsystems:
        list_ids[subsystem.name] = create_list(board_id, subsystem.name)
    milestone_list_id = create_list(board_id, "Milestones")

    for subsystem in subsystems:
        for task in subsystem.tasks:
            card_id = create_card(
                list_ids[subsystem.name],
                task.title,
                build_description(subsystem.name, task),
                format_due(task.start_date, task.duration_days),
                [label_ids[subsystem.name]],
            )
            add_checklist(card_id, task.checklist)

    for task in milestones:
        card_id = create_card(
            milestone_list_id,
            task.title,
            build_description("Milestones", task),
            format_due(task.start_date, task.duration_days),
            [label_ids["Milestone"]],
        )
        add_checklist(card_id, ["Treat this as a delivery milestone."])

    print(f"Trello roadmap created or updated on board: {board_id}")


if __name__ == "__main__":
    run()