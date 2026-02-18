#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import sys
from pathlib import Path
from typing import Any


def _project_root() -> Path:
    # web/src-tauri/py_bridge.py -> project root is ../../
    return Path(__file__).resolve().parents[2]


def _setup_imports() -> None:
    root = _project_root()
    src_path = root / "src"
    sys.path.insert(0, str(src_path))


def _cover_to_data_url(data: bytes | None, mime: str | None) -> str | None:
    if not data or not mime:
        return None
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def _parse_data_url(data_url: str) -> tuple[bytes, str]:
    if not data_url.startswith("data:"):
        raise ValueError("cover_data_url non valido")

    header, encoded = data_url.split(",", 1)
    if ";base64" not in header:
        raise ValueError("cover_data_url deve essere base64")

    mime = header[5 : header.index(";base64")].strip() or "image/jpeg"
    return base64.b64decode(encoded), mime


def scan(folder_path: str) -> dict[str, Any]:
    _setup_imports()
    from musicmanager.tags import read_cover_art, read_metadata

    root = Path(folder_path)
    tracks: list[dict[str, Any]] = []

    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".mp3", ".flac"}:
            continue

        meta = read_metadata(path)
        cover_data, cover_mime = read_cover_art(path)
        cover_url = _cover_to_data_url(cover_data, cover_mime)

        title = str(meta.get("title", "") or "")
        artist = str(meta.get("artist", "") or "")
        album = str(meta.get("album", "") or "")
        tracknumber = str(meta.get("tracknumber", "") or "")
        year = str(meta.get("date", "") or "")
        genre = str(meta.get("genre", "") or "")

        tracks.append(
            {
                "id": str(path),
                "path": str(path),
                "title": title or path.stem,
                "artist": artist,
                "album": album,
                "tracknumber": tracknumber,
                "year": year[:4],
                "genre": genre,
                "has_cover": bool(cover_url),
                "cover_data_url": cover_url,
            }
        )

    tracks.sort(key=lambda t: t["path"])
    return {"folder_path": str(root), "tracks": tracks}


def save(payload: dict[str, Any]) -> dict[str, Any]:
    _setup_imports()
    from musicmanager.tags import write_cover_art, write_metadata

    path = Path(str(payload["path"]))
    if not path.exists():
        raise FileNotFoundError(f"File non trovato: {path}")

    fields = {
        "title": str(payload.get("title", "") or ""),
        "artist": str(payload.get("artist", "") or ""),
        "album": str(payload.get("album", "") or ""),
        "tracknumber": str(payload.get("tracknumber", "") or ""),
        "date": str(payload.get("year", "") or ""),
        "genre": str(payload.get("genre", "") or ""),
    }

    write_metadata(path, fields)

    cover_data_url = payload.get("cover_data_url")
    if isinstance(cover_data_url, str) and cover_data_url.strip():
        image_data, mime = _parse_data_url(cover_data_url)
        write_cover_art(path, image_data, mime)

    rename_fields_raw = payload.get("rename_fields")
    rename_separator = str(payload.get("rename_separator", "") or "").strip() or " - "
    rename_fields = (
        [str(v) for v in rename_fields_raw if isinstance(v, str)] if isinstance(rename_fields_raw, list) else []
    )

    renamed_path = path
    if rename_fields:
        renamed_path = _rename_file_by_fields(path, fields, rename_fields, rename_separator)

    return {"ok": True, "path": str(renamed_path)}


def rename(payload: dict[str, Any]) -> dict[str, Any]:
    path = Path(str(payload["path"]))
    if not path.exists():
        raise FileNotFoundError(f"File non trovato: {path}")

    fields = {
        "title": str(payload.get("title", "") or ""),
        "artist": str(payload.get("artist", "") or ""),
        "album": str(payload.get("album", "") or ""),
        "tracknumber": str(payload.get("tracknumber", "") or ""),
        "date": str(payload.get("year", "") or ""),
        "genre": str(payload.get("genre", "") or ""),
    }

    rename_fields_raw = payload.get("rename_fields")
    rename_separator = str(payload.get("rename_separator", "") or "").strip() or " - "
    rename_fields = (
        [str(v) for v in rename_fields_raw if isinstance(v, str)] if isinstance(rename_fields_raw, list) else []
    )

    renamed_path = _rename_file_by_fields(path, fields, rename_fields, rename_separator) if rename_fields else path
    return {"ok": True, "path": str(renamed_path)}


def _rename_file_by_fields(path: Path, fields: dict[str, str], order: list[str], separator: str) -> Path:
    value_by_field = {
        "tracknumber": fields.get("tracknumber", ""),
        "artist": fields.get("artist", ""),
        "album": fields.get("album", ""),
        "title": fields.get("title", ""),
        "year": fields.get("date", ""),
        "genre": fields.get("genre", ""),
    }

    raw_parts = [str(value_by_field.get(name, "") or "").strip() for name in order]
    clean_parts = [_sanitize_filename(part) for part in raw_parts if part]
    if not clean_parts:
        return path

    base_name = separator.join(clean_parts).strip()
    if not base_name:
        return path

    candidate = path.with_name(f"{base_name}{path.suffix}")
    candidate = _unique_path(candidate)
    if candidate == path:
        return path

    path.rename(candidate)
    return candidate


def _unique_path(path: Path) -> Path:
    if not path.exists():
        return path

    stem = path.stem
    suffix = path.suffix
    parent = path.parent
    index = 1
    while True:
        candidate = parent / f"{stem} ({index}){suffix}"
        if not candidate.exists():
            return candidate
        index += 1


def _sanitize_filename(value: str) -> str:
    invalid = '<>:"/\\|?*'
    out = "".join("_" if c in invalid else c for c in value)
    out = out.replace("\n", " ").replace("\r", " ")
    return " ".join(out.split()).strip(" .")


def main() -> int:
    if len(sys.argv) < 2:
        print("missing command", file=sys.stderr)
        return 1

    command = sys.argv[1]
    try:
        if command == "scan":
            if len(sys.argv) < 3:
                raise ValueError("missing folder path")
            result = scan(sys.argv[2])
            print(json.dumps(result))
            return 0

        if command == "save":
            payload = json.loads(sys.stdin.read() or "{}")
            result = save(payload)
            print(json.dumps(result))
            return 0

        if command == "rename":
            payload = json.loads(sys.stdin.read() or "{}")
            result = rename(payload)
            print(json.dumps(result))
            return 0

        raise ValueError(f"unsupported command: {command}")
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
