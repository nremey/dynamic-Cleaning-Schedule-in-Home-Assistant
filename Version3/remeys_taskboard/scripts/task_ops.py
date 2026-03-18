#!/usr/bin/env python3
import base64
import json
import os
import random
import re
import string
import sys
import tempfile
from datetime import datetime
from typing import Any, Dict, List, Tuple

ASSIGNMENT_RE = re.compile(r"window\.(?:TABLE_DATA|PP_TASKS_DATA)\s*=\s*", re.MULTILINE)
MONTH_MASK_ALL = (1 << 12) - 1
WEEK_MASK_ALL = (1 << 7) - 1


def fail(msg: str, code: int = 1) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(code)


def safe_obj(v: Any) -> Dict[str, Any]:
    return v if isinstance(v, dict) else {}


def ensure_uid(value: str = "") -> str:
    s = str(value or "").strip()
    if s:
        return s
    seed = datetime.utcnow().strftime("%y%m%d%H%M%S")
    tail = "".join(random.choices(string.ascii_lowercase + string.digits, k=5))
    return f"task_{seed}_{tail}"


def parse_js_table_assignment(raw: str) -> Tuple[int, int, List[Dict[str, Any]], str]:
    m = ASSIGNMENT_RE.search(raw)
    if not m:
        fail("Could not find TABLE_DATA/PP_TASKS_DATA assignment in JS file.")

    idx = m.end()
    while idx < len(raw) and raw[idx].isspace():
        idx += 1
    if idx >= len(raw) or raw[idx] != "[":
        fail("Assignment found, but array start '[' is missing.")

    start = idx
    depth = 0
    in_string = False
    esc = False
    quote = ""
    i = start
    while i < len(raw):
        ch = raw[i]
        if in_string:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                in_string = False
        else:
            if ch in ('"', "'"):
                in_string = True
                quote = ch
            elif ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        i += 1
    else:
        fail("Could not find matching closing bracket for task array.")

    arr_src = raw[start:end]
    try:
        arr = json.loads(arr_src)
    except Exception as exc:
        fail(f"Failed to parse task array JSON: {exc}")

    if not isinstance(arr, list):
        fail("Parsed task payload is not a list.")

    cleaned: List[Dict[str, Any]] = []
    for item in arr:
        if isinstance(item, dict):
            cleaned.append(item)

    key_match = re.search(r"window\.(TABLE_DATA|PP_TASKS_DATA)", raw[m.start():m.end()])
    assign_key = key_match.group(1) if key_match else "TABLE_DATA"
    return start, end, cleaned, assign_key


def parse_js_table_assignment_or_empty(raw: str) -> Tuple[str, int, int, List[Dict[str, Any]], str]:
    if not str(raw or "").strip():
        seed = "window.PP_TASKS_DATA = [];\n"
        start, end, rows, key = parse_js_table_assignment(seed)
        return seed, start, end, rows, key
    m = ASSIGNMENT_RE.search(raw)
    if not m:
        seed = str(raw or "").rstrip() + ("\n" if raw and not raw.endswith("\n") else "")
        seed += "window.PP_TASKS_DATA = [];\n"
        start, end, rows, key = parse_js_table_assignment(seed)
        return seed, start, end, rows, key
    start, end, rows, key = parse_js_table_assignment(raw)
    return raw, start, end, rows, key


def write_js_array_only(path: str, raw: str, start: int, end: int, rows: List[Dict[str, Any]]) -> None:
    rendered = json.dumps(rows, ensure_ascii=False, indent=2)
    out = raw[:start] + rendered + raw[end:]

    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix="tasks-ops-", suffix=".js", dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(out)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def find_task_index(rows: List[Dict[str, Any]], uid: str) -> int:
    for i, row in enumerate(rows):
        if str(row.get("__uid") or "").strip() == uid:
            return i
    return -1


def normalize_sort_key(v: Any) -> str:
    return str(v or "").strip().lower()


def normalize_unit(u: Any) -> str:
    s = str(u or "").strip().lower()
    if s in ("w", "week", "weeks"):
        return "w"
    if s in ("m", "month", "months"):
        return "m"
    return "d"


def days_in_month(year: int, month_index_0: int) -> int:
    # month_index_0 is 0..11
    if month_index_0 == 11:
        nxt = datetime(year + 1, 1, 1)
    else:
        nxt = datetime(year, month_index_0 + 2, 1)
    curr = datetime(year, month_index_0 + 1, 1)
    return (nxt - curr).days


def add_months_clamped(d: datetime, months: int) -> datetime:
    month0 = d.month - 1 + int(months or 0)
    year = d.year + (month0 // 12)
    month0 = month0 % 12
    day = min(d.day, days_in_month(year, month0))
    return datetime(year, month0 + 1, day)


def add_by_rhythm(d: datetime, amount: Any, unit: Any) -> datetime:
    u = normalize_unit(unit)
    n = int(float(amount or 0))
    if u == "m":
        return add_months_clamped(d, n)
    if u == "w":
        return d.fromordinal(d.toordinal() + (n * 7))
    return d.fromordinal(d.toordinal() + n)


def normalize_month_mask(v: Any) -> int:
    try:
        n = int(float(v))
    except Exception:
        return MONTH_MASK_ALL
    m = n & MONTH_MASK_ALL
    return m if m else MONTH_MASK_ALL


def normalize_week_mask(v: Any) -> int:
    try:
        n = int(float(v))
    except Exception:
        return WEEK_MASK_ALL
    m = n & WEEK_MASK_ALL
    return m if m else WEEK_MASK_ALL


def weekday_index_mon0(d: datetime) -> int:
    # Python: Monday=0 ... Sunday=6
    return int(d.weekday())


def is_month_allowed(mask: Any, month_index_0: int) -> bool:
    m = normalize_month_mask(mask)
    return ((m >> month_index_0) & 1) == 1


def is_weekday_allowed(mask: Any, weekday_mon0: int) -> bool:
    m = normalize_week_mask(mask)
    return ((m >> weekday_mon0) & 1) == 1


def shift_to_allowed_month(d: datetime, month_mask: Any) -> datetime:
    x = datetime(d.year, d.month, d.day)
    guard = 0
    while not is_month_allowed(month_mask, x.month - 1):
        if x.month == 12:
            x = datetime(x.year + 1, 1, 1)
        else:
            x = datetime(x.year, x.month + 1, 1)
        guard += 1
        if guard > 24:
            break
    return x


def shift_to_allowed_weekday(d: datetime, week_mask: Any) -> datetime:
    x = datetime(d.year, d.month, d.day)
    guard = 0
    while not is_weekday_allowed(week_mask, weekday_index_mon0(x)):
        x = x.fromordinal(x.toordinal() + 1)
        guard += 1
        if guard > 14:
            break
    return x


def shift_to_allowed_date(d: datetime, month_mask: Any, week_mask: Any) -> datetime:
    x = datetime(d.year, d.month, d.day)
    guard = 0
    while guard < 62:
        guard += 1
        if not is_month_allowed(month_mask, x.month - 1):
            x = shift_to_allowed_month(x, month_mask)
            continue
        if not is_weekday_allowed(week_mask, weekday_index_mon0(x)):
            x = shift_to_allowed_weekday(x, week_mask)
            continue
        break
    return x


def normalize_task_payload(raw: Any) -> Dict[str, Any]:
    row = safe_obj(raw)
    out = dict(row)
    out["__uid"] = ensure_uid(out.get("__uid"))
    return out


def op_add_task(rows: List[Dict[str, Any]], payload: Dict[str, Any]) -> Dict[str, Any]:
    task = normalize_task_payload(payload.get("task"))
    uid = str(task.get("__uid") or "").strip()
    if find_task_index(rows, uid) >= 0:
        fail(f"Task with __uid already exists: {uid}")
    rows.append(task)
    return {"task": task}


def op_edit_task(rows: List[Dict[str, Any]], payload: Dict[str, Any]) -> Dict[str, Any]:
    target = str(payload.get("target_id") or payload.get("__uid") or "").strip()
    if not target:
        fail("edit_task requires target_id or __uid.")
    idx = find_task_index(rows, target)
    if idx < 0:
        fail(f"Task not found: {target}")

    existing = rows[idx]
    patch = safe_obj(payload.get("patch"))
    incoming = safe_obj(payload.get("task"))

    if incoming:
        updated = normalize_task_payload(incoming)
    else:
        updated = dict(existing)
        updated.update(patch)
        updated["__uid"] = ensure_uid(updated.get("__uid") or target)

    new_uid = str(updated.get("__uid") or "").strip()
    if not new_uid:
        fail("Edited task must contain __uid.")
    other = find_task_index(rows, new_uid)
    if other >= 0 and other != idx:
        fail(f"Task __uid collision: {new_uid}")

    rows[idx] = updated
    return {"task": updated}


def op_delete_task(rows: List[Dict[str, Any]], payload: Dict[str, Any]) -> Dict[str, Any]:
    target = str(payload.get("target_id") or payload.get("__uid") or "").strip()
    if not target:
        fail("delete_task requires target_id or __uid.")
    idx = find_task_index(rows, target)
    if idx < 0:
        fail(f"Task not found: {target}")
    removed = rows.pop(idx)
    return {"task": removed}


def op_get_task(rows: List[Dict[str, Any]], payload: Dict[str, Any]) -> Dict[str, Any]:
    target = str(payload.get("target_id") or payload.get("__uid") or "").strip()
    if not target:
        fail("get_task requires target_id or __uid.")
    idx = find_task_index(rows, target)
    if idx < 0:
        fail(f"Task not found: {target}")
    return {"task": rows[idx]}


def op_mark_done(rows: List[Dict[str, Any]], payload: Dict[str, Any]) -> Dict[str, Any]:
    target = str(payload.get("target_id") or payload.get("__uid") or payload.get("task_uuid") or "").strip()
    if not target:
        fail("mark_done requires task_uuid/target_id.")
    idx = find_task_index(rows, target)
    if idx < 0:
        fail(f"Task not found: {target}")

    row = rows[idx]
    now = datetime.now()
    now_iso = now.strftime("%Y-%m-%d")
    done_by = str(payload.get("assignee") or payload.get("done_by") or "").strip() or str(row.get("Last done [By]") or "").strip() or "automation"

    prev_last = str(row.get("Last done [Date]") or "").strip()
    hist = row.get("__history")
    if not isinstance(hist, list):
        hist = []
    next_hist = [str(x).strip() for x in hist if str(x).strip()]
    if prev_last:
        next_hist.append(prev_last)
    next_hist.append(now_iso)
    seen = set()
    uniq_hist = []
    for item in next_hist:
        if item in seen:
            continue
        seen.add(item)
        uniq_hist.append(item)

    doneby_hist = row.get("__history_doneby")
    if not isinstance(doneby_hist, list):
        doneby_hist = []
    cleaned_doneby = []
    for h in doneby_hist:
        if not isinstance(h, dict):
            continue
        d = str(h.get("date") or "").strip()
        u = str(h.get("user") or "").strip()
        if not d or not u or d == now_iso:
            continue
        cleaned_doneby.append({"date": d, "user": u})
    cleaned_doneby.append({"date": now_iso, "user": done_by})

    calc_raw = add_by_rhythm(now, row.get("Rhythmen", 0), row.get("RhythmUnit"))
    calc_due = shift_to_allowed_date(calc_raw, row.get("MonthMask"), row.get("WeekMask"))

    manual_due = None
    manual_due_str = str(row.get("New Due date [date]") or "").strip()
    if manual_due_str:
        try:
            manual_due = datetime.fromisoformat(manual_due_str)
        except Exception:
            manual_due = None

    nxt = calc_due
    if manual_due is not None:
        manual_bad = manual_due.date() < now.date()
        calc_later = calc_due.date() > manual_due.date()
        nxt = calc_due if (manual_bad or calc_later) else manual_due

    row["Last done [Date]"] = now_iso
    row["Last done [By]"] = done_by
    row["__history"] = uniq_hist
    row["__history_doneby"] = cleaned_doneby
    row["New Due date [date]"] = nxt.strftime("%Y-%m-%d")
    row["Due in [days]"] = (nxt.date() - now.date()).days

    return {"task": row}


def op_get_tasklist(rows: List[Dict[str, Any]], payload: Dict[str, Any]) -> Dict[str, Any]:
    area = str(payload.get("area") or "").strip().lower()
    assignee = str(payload.get("assignee") or "").strip().lower()
    q = str(payload.get("query") or "").strip().lower()

    out = rows
    if area:
        out = [r for r in out if str(r.get("Area") or "").strip().lower() == area]
    if assignee:
        out = [r for r in out if assignee in str(r.get("Assignee") or "").strip().lower()]
    if q:
        out = [
            r for r in out
            if q in str(r.get("Task") or "").lower()
            or q in str(r.get("Area") or "").lower()
            or q in str(r.get("Notes") or "").lower()
        ]
    return {"tasklist": out}


def op_sort_tasklist(rows: List[Dict[str, Any]], payload: Dict[str, Any]) -> Dict[str, Any]:
    sort_by = normalize_sort_key(payload.get("sort_by") or "due")
    order = normalize_sort_key(payload.get("order") or "asc")
    reverse = order == "desc"

    def key_due(r: Dict[str, Any]) -> Any:
        n = r.get("Due in [days]")
        try:
            return float(n)
        except Exception:
            return float("inf")

    def key_area(r: Dict[str, Any]) -> Any:
        return str(r.get("Area") or "").lower()

    def key_task(r: Dict[str, Any]) -> Any:
        return str(r.get("Task") or "").lower()

    key_map = {
        "due": key_due,
        "area": key_area,
        "task": key_task,
        "last_done": lambda r: str(r.get("Last done [Date]") or ""),
    }
    key_fn = key_map.get(sort_by, key_due)
    rows.sort(key=key_fn, reverse=reverse)
    return {"tasklist": rows}


def op_recalculate_due_days(rows: List[Dict[str, Any]], payload: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now().date()
    updated = 0

    for row in rows:
        if not isinstance(row, dict):
            continue
        due_str = str(row.get("New Due date [date]") or "").strip()
        if not due_str:
            continue
        try:
            due = datetime.fromisoformat(due_str).date()
        except Exception:
            continue
        row["Due in [days]"] = (due - now).days
        updated += 1

    return {"tasklist": rows, "updated": updated}


def decode_payload_b64(payload_b64: str) -> Dict[str, Any]:
    try:
        raw = base64.b64decode(payload_b64.encode("utf-8")).decode("utf-8")
    except Exception as exc:
        fail(f"Invalid payload_b64: {exc}")
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except Exception as exc:
        fail(f"Invalid payload JSON: {exc}")
    return payload if isinstance(payload, dict) else {}


def main() -> None:
    if len(sys.argv) < 5:
        fail("Usage: task_ops.py <path> <filename> <operation> <payload_b64>")

    path = str(sys.argv[1] or "").strip()
    filename = str(sys.argv[2] or "").strip()
    operation = str(sys.argv[3] or "").strip()
    payload_b64 = str(sys.argv[4] or "").strip()

    if not path or not filename:
        fail("path and filename are required.")
    if not operation:
        fail("operation is required.")

    payload = decode_payload_b64(payload_b64)
    file_path = os.path.join(path, filename)
    raw = open(file_path, "r", encoding="utf-8").read() if os.path.exists(file_path) else ""
    raw_norm, start, end, rows, assign_key = parse_js_table_assignment_or_empty(raw)

    handlers = {
        "add_task": (True, op_add_task),
        "edit_task": (True, op_edit_task),
        "delete_task": (True, op_delete_task),
        "mark_done": (True, op_mark_done),
        "get_task": (False, op_get_task),
        "get_tasklist": (False, op_get_tasklist),
        "sort_tasklist": (True, op_sort_tasklist),
        "recalculate_due_days": (True, op_recalculate_due_days),
    }

    pair = handlers.get(operation)
    if not pair:
        fail(f"Unsupported operation: {operation}")
    mutates, fn = pair

    result = fn(rows, payload)
    if mutates:
        write_js_array_only(file_path, raw_norm, start, end, rows)

    output = {
        "ok": True,
        "operation": operation,
        "data_key": assign_key,
        "count": len(rows),
        **(result if isinstance(result, dict) else {}),
    }
    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    main()
