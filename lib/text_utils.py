"""Text processing utilities — cleaning, normalization, metadata formatting.

Used by: youtubeBatchUpload, metaBatchReelsUpload, youtubeFixRepeatedMetadata
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List


def clean_text(value: str) -> str:
    """Strip and collapse whitespace."""
    return re.sub(r"\s+", " ", value).strip()


def clean_one_line(text: str) -> str:
    """Flatten text to a single line."""
    return re.sub(r"\s+", " ", str(text)).strip()


def clean_multiline(text: str) -> str:
    """Normalize multiline text — trim lines, collapse blank runs."""
    lines = [line.strip() for line in str(text).splitlines()]
    return "\n".join(lines).strip()


def parse_json_response(raw: str) -> Dict[str, Any]:
    """Extract JSON from a response that may contain markdown fences."""
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        if len(lines) >= 3:
            raw = "\n".join(lines[1:-1])
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def normalize_hashtag(tag: str) -> str:
    """Ensure a tag starts with # and has no spaces."""
    tag = tag.strip().replace(" ", "")
    if not tag.startswith("#"):
        tag = f"#{tag}"
    return tag


def normalize_tags(
    tags: List[str],
    max_total_chars: int = 500,
    max_tags: int = 15,
) -> List[str]:
    """Deduplicate, normalize, and trim tags to fit platform limits."""
    seen: set[str] = set()
    result: List[str] = []
    total_len = 0
    for tag in tags:
        normalized = normalize_hashtag(tag)
        lower = normalized.lower()
        if lower in seen:
            continue
        if total_len + len(normalized) + 1 > max_total_chars:
            break
        if len(result) >= max_tags:
            break
        seen.add(lower)
        result.append(normalized)
        total_len += len(normalized) + 1
    return result


def trim_title(title: str, max_len: int = 100) -> str:
    """Truncate a title to max_len, preserving word boundaries."""
    title = clean_text(title)
    if len(title) <= max_len:
        return title
    truncated = title[:max_len].rsplit(" ", 1)[0]
    return truncated.rstrip(".,;:-") + "..."


def normalize_handle(value: str) -> str:
    """Normalize a social media handle — strip @, lowercase."""
    return value.strip().lstrip("@").lower()


def normalize_compare_text(text: str) -> str:
    """Normalize text for comparison — lowercase, strip punctuation."""
    return re.sub(r"[^a-z0-9\s]", "", str(text).lower()).strip()


def text_similarity(a: str, b: str) -> float:
    """Simple word-overlap similarity between two strings (0-1)."""
    words_a = set(normalize_compare_text(a).split())
    words_b = set(normalize_compare_text(b).split())
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union)


def get_sidecar_value(payload: Dict[str, Any], *keys: str) -> Any:
    """Get a nested value from a dict by key path."""
    current: Any = payload
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current
