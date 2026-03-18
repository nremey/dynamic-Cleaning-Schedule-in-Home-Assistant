#!/usr/bin/env python3
import json
import os
import sys
from datetime import date, datetime
from pathlib import Path
from urllib.request import Request, urlopen

WEBHOOK_URL = "http://127.0.0.1:8123/api/webhook/taskboard_due_digest"
STAMP_FILE = Path("/tmp/remeys_taskboard_alert_last.txt")


def resolve_base_dir() -> Path:
    env_base = str(os.environ.get("PP_BASE_DIR") or "").strip()
    if env_base:
        return Path(env_base)
    here = Path(__file__).resolve()
    # .../a_remeys_taskboard/scripts/taskboard_due_digest_script.py -> .../a_remeys_taskboard
    return here.parent.parent


def parse_tasklist(path: Path) -> list:
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8")
    start = raw.find("[")
    end = raw.rfind("]")
    if start == -1 or end == -1 or end < start:
        return []
    try:
        data = json.loads(raw[start : end + 1])
        return data if isinstance(data, list) else []
    except Exception:
        return []


def parse_global_settings(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def split_tokens(text: str) -> list:
    return [x.strip().lower() for x in str(text or "").split(",") if x.strip()]


def matches_assignee(item: dict, assignee_filter: str) -> bool:
    wanted = split_tokens(assignee_filter)
    if not wanted:
        return True
    assignees = split_tokens(item.get("Assignee", ""))
    if not assignees:
        return False
    return any(w in assignees for w in wanted)


def should_send_now(alert_time_hhmm: str) -> bool:
    force = "--force" in sys.argv
    now = datetime.now()
    now_hhmm = now.strftime("%H:%M")
    if not force and alert_time_hhmm != now_hhmm:
        return False

    stamp = f"{now.date().isoformat()} {alert_time_hhmm}"
    prev = ""
    if STAMP_FILE.exists():
        try:
            prev = STAMP_FILE.read_text(encoding="utf-8").strip()
        except Exception:
            prev = ""
    if not force and prev == stamp:
        return False
    try:
        STAMP_FILE.write_text(stamp, encoding="utf-8")
    except Exception:
        pass
    return True


def main() -> int:
    base_dir = resolve_base_dir()
    task_file = base_dir / "userdata" / "tasklist.js"
    settings_file = base_dir / "usersettings" / "global.settings.json"

    settings = parse_global_settings(settings_file)
    alerts = settings.get("alerts") if isinstance(settings.get("alerts"), dict) else {}
    notify_service = str(alerts.get("deviceService") or "notify.notify").strip() or "notify.notify"
    alert_time = str(alerts.get("time") or "18:00").strip()
    if len(alert_time) >= 8 and ":" in alert_time:
        alert_time = alert_time[:5]
    if len(alert_time) != 5:
        alert_time = "18:00"
    assignee_filter = str(alerts.get("assigneeFilter") or "").strip()

    if not should_send_now(alert_time):
        return 0

    items = parse_tasklist(task_file)
    today = date.today()
    grouped = {}

    for item in items:
        if not isinstance(item, dict):
            continue
        due_str = str(item.get("New Due date [date]") or "").strip()
        task = str(item.get("Task") or "").strip()
        area = str(item.get("Area") or "Unbekannt").strip() or "Unbekannt"
        if not due_str or not task or not matches_assignee(item, assignee_filter):
            continue
        try:
            due = date.fromisoformat(due_str)
        except ValueError:
            continue
        if due <= today:
            grouped.setdefault(area, []).append(task)

    if not grouped:
        whatstodo = "Keine fälligen Aufgaben."
    else:
        parts = []
        for area in sorted(grouped):
            tasks = "\n  - ".join(grouped[area])
            parts.append(f"{area}:\n  - {tasks}")
        whatstodo = "\n\n".join(parts)

    payload = json.dumps(
        {
            "whatstodo": whatstodo,
            "notify_service": notify_service,
            "assignee_filter": assignee_filter,
            "alert_time": alert_time,
        }
    ).encode("utf-8")

    req = Request(
        WEBHOOK_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urlopen(req, timeout=10).read()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
