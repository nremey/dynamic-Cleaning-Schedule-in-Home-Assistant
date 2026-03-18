#!/usr/bin/env python3
import base64
import json
import os
import sys
import tempfile
from typing import Any, Dict, List, Tuple


def fail(msg: str, code: int = 1) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(code)


def safe_obj(v: Any) -> Dict[str, Any]:
    return v if isinstance(v, dict) else {}


def normalize_aliases(raw: Any) -> Dict[str, List[str]]:
    aliases = safe_obj(raw)
    out: Dict[str, List[str]] = {}
    for lang in ("de", "en", "ja"):
        arr = aliases.get(lang)
        if not isinstance(arr, list):
            arr = []
        seen = set()
        clean: List[str] = []
        for x in arr:
            s = str(x or "").strip()
            k = s.lower()
            if not s or k in seen:
                continue
            seen.add(k)
            clean.append(s)
        out[lang] = clean
    return out


def normalize_item(raw: Any) -> Dict[str, Any]:
    item = safe_obj(raw)
    label = safe_obj(item.get("label"))
    return {
        "id": str(item.get("id") or "").strip(),
        "label": {
            "de": str(label.get("de") or ""),
            "en": str(label.get("en") or ""),
            "ja": str(label.get("ja") or ""),
        },
        "aliases": normalize_aliases(item.get("aliases")),
        "icon": str(item.get("icon") or "mdi:cart-outline").strip() or "mdi:cart-outline",
    }


def normalize_category(raw: Any) -> Dict[str, Any]:
    cat = safe_obj(raw)
    title = safe_obj(cat.get("title"))
    items = cat.get("items") if isinstance(cat.get("items"), list) else []
    return {
        "id": str(cat.get("id") or "").strip(),
        "title": {
            "de": str(title.get("de") or ""),
            "en": str(title.get("en") or ""),
            "ja": str(title.get("ja") or ""),
        },
        "items": [normalize_item(i) for i in items],
    }


def load_catalog(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        return {"categories": []}
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    cats = raw.get("categories") if isinstance(raw, dict) else []
    if not isinstance(cats, list):
        cats = []
    return {"categories": [normalize_category(c) for c in cats]}


def save_catalog(path: str, catalog: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix="product-catalog-", suffix=".json", dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def find_category_idx(cats: List[Dict[str, Any]], category_id: str) -> int:
    for i, c in enumerate(cats):
        if str(c.get("id") or "") == category_id:
            return i
    return -1


def find_item(cats: List[Dict[str, Any]], item_id: str) -> Tuple[int, int]:
    for ci, cat in enumerate(cats):
        for ii, item in enumerate(cat.get("items") or []):
            if str(item.get("id") or "") == item_id:
                return ci, ii
    return -1, -1


def assert_item_id_unique(cats: List[Dict[str, Any]], item_id: str, exclude: str = "") -> None:
    if not item_id:
        fail("Item id is required.")
    ci, ii = find_item(cats, item_id)
    if ci >= 0:
        current = str(cats[ci]["items"][ii].get("id") or "")
        if not exclude or current != exclude:
            fail(f"Item id already exists: {item_id}")


def op_foodgoup_add(catalog: Dict[str, Any], payload: Dict[str, Any]) -> None:
    cats = catalog["categories"]
    cat = normalize_category(payload.get("category"))
    cat_id = str(payload.get("id") or cat.get("id") or "").strip()
    if not cat_id:
        fail("foodgoup_add requires category id.")
    if find_category_idx(cats, cat_id) >= 0:
        fail(f"Category id already exists: {cat_id}")
    cat["id"] = cat_id
    cats.append(cat)


def op_foodgoup_edit(catalog: Dict[str, Any], payload: Dict[str, Any]) -> None:
    cats = catalog["categories"]
    target_id = str(payload.get("target_id") or "").strip()
    if not target_id:
        fail("foodgoup_edit requires target_id.")
    idx = find_category_idx(cats, target_id)
    if idx < 0:
        fail(f"Category not found: {target_id}")
    current = cats[idx]
    incoming = normalize_category(payload.get("category"))
    next_id = str(incoming.get("id") or target_id).strip()
    if not next_id:
        fail("foodgoup_edit requires category.id or target_id.")
    if next_id != target_id and find_category_idx(cats, next_id) >= 0:
        fail(f"Category id already exists: {next_id}")
    cats[idx] = {
        "id": next_id,
        "title": incoming.get("title") or current.get("title"),
        "items": current.get("items") or [],
    }


def op_foodgoup_delete(catalog: Dict[str, Any], payload: Dict[str, Any]) -> None:
    cats = catalog["categories"]
    target_id = str(payload.get("target_id") or "").strip()
    if not target_id:
        fail("foodgoup_delete requires target_id.")
    idx = find_category_idx(cats, target_id)
    if idx < 0:
        fail(f"Category not found: {target_id}")
    del cats[idx]


def op_item_add(catalog: Dict[str, Any], payload: Dict[str, Any]) -> None:
    cats = catalog["categories"]
    category_id = str(payload.get("category_id") or "").strip()
    if not category_id:
        fail("item_add requires category_id.")
    cidx = find_category_idx(cats, category_id)
    if cidx < 0:
        fail(f"Category not found: {category_id}")
    item = normalize_item(payload.get("item"))
    item_id = str(item.get("id") or "").strip()
    assert_item_id_unique(cats, item_id)
    cats[cidx].setdefault("items", []).append(item)


def op_item_edit(catalog: Dict[str, Any], payload: Dict[str, Any]) -> None:
    cats = catalog["categories"]
    target_id = str(payload.get("target_id") or "").strip()
    if not target_id:
        fail("item_edit requires target_id.")
    src_ci, src_ii = find_item(cats, target_id)
    if src_ci < 0:
        fail(f"Item not found: {target_id}")

    item = normalize_item(payload.get("item"))
    next_id = str(item.get("id") or "").strip()
    assert_item_id_unique(cats, next_id, exclude=target_id)

    dest_category_id = str(payload.get("category_id") or cats[src_ci].get("id") or "").strip()
    dest_ci = find_category_idx(cats, dest_category_id)
    if dest_ci < 0:
        fail(f"Destination category not found: {dest_category_id}")

    del cats[src_ci]["items"][src_ii]
    cats[dest_ci].setdefault("items", []).append(item)


def op_item_delete(catalog: Dict[str, Any], payload: Dict[str, Any]) -> None:
    cats = catalog["categories"]
    target_id = str(payload.get("target_id") or "").strip()
    if not target_id:
        fail("item_delete requires target_id.")
    ci, ii = find_item(cats, target_id)
    if ci < 0:
        fail(f"Item not found: {target_id}")
    del cats[ci]["items"][ii]


def main() -> None:
    if len(sys.argv) < 5:
        fail("Usage: product_catalog_ops.py <path> <filename> <operation> <payload_b64>")

    path = str(sys.argv[1] or "").strip()
    filename = str(sys.argv[2] or "").strip()
    operation = str(sys.argv[3] or "").strip()
    payload_b64 = str(sys.argv[4] or "").strip()

    if not path or not filename:
        fail("path and filename are required.")
    if not operation:
        fail("operation is required.")

    try:
        payload_raw = base64.b64decode(payload_b64.encode("utf-8")).decode("utf-8")
        payload = json.loads(payload_raw) if payload_raw.strip() else {}
    except Exception as exc:
        fail(f"Invalid payload_b64: {exc}")

    file_path = os.path.join(path, filename)
    catalog = load_catalog(file_path)

    handlers = {
        "item_add": op_item_add,
        "item_edit": op_item_edit,
        "item_delete": op_item_delete,
        "foodgoup_add": op_foodgoup_add,
        "foodgoup_edit": op_foodgoup_edit,
        "foodgoup_delete": op_foodgoup_delete,
        # optional typo-safe alias
        "foodgroup_add": op_foodgoup_add,
        "foodgroup_edit": op_foodgoup_edit,
        "foodgroup_delete": op_foodgoup_delete,
    }

    fn = handlers.get(operation)
    if not fn:
        fail(f"Unsupported operation: {operation}")

    fn(catalog, payload if isinstance(payload, dict) else {})
    save_catalog(file_path, catalog)
    print("OK")


if __name__ == "__main__":
    main()
