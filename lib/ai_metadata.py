"""AI metadata generation — clip context, fallback metadata, OpenAI integration.

Generates YouTube Shorts metadata using OpenAI API or falls back to
template-based metadata from sidecar JSON files.
"""
from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from lib.file_utils import load_json_file
from lib.text_utils import (
    clean_text, get_sidecar_value, normalize_tags, trim_title,
    normalize_handle, parse_json_response, normalize_compare_text,
)


def load_clip_context(file_path: Path) -> Optional[Dict[str, Any]]:
    """Load gameplay context from a sidecar JSON file next to the video."""
    sidecar_path = file_path.with_suffix(".json")
    payload = load_json_file(sidecar_path, default=None)

    if not isinstance(payload, dict):
        return None

    raw_kills = get_sidecar_value(payload, "kills", "kill_count", "killcount")
    kills: Optional[int] = None
    if raw_kills is not None:
        try:
            kills = max(int(raw_kills), 1)
        except (TypeError, ValueError):
            kills = None

    site_name_raw = get_sidecar_value(payload, "site_name", "site name", "site", "map")
    agent_name_raw = get_sidecar_value(payload, "agent_name", "agent name", "agent")
    round_details = payload.get("round_details", {})
    if not isinstance(round_details, dict):
        round_details = {}
    kills_breakdown = round_details.get("kills_breakdown", [])
    if not isinstance(kills_breakdown, list):
        kills_breakdown = []
    first_kill = kills_breakdown[0] if kills_breakdown and isinstance(kills_breakdown[0], dict) else {}

    weapon_raw = get_sidecar_value(payload, "weapon")
    if weapon_raw is None and isinstance(first_kill, dict):
        weapon_raw = first_kill.get("weapon")

    headshots_raw = get_sidecar_value(payload, "headshots", "total_headshots")
    if headshots_raw is None:
        headshots_raw = round_details.get("total_headshots")

    victim_agent_raw = get_sidecar_value(payload, "victim_agent", "victim agent")
    if victim_agent_raw is None and isinstance(first_kill, dict):
        victim_agent_raw = first_kill.get("victim_agent")

    site_name = clean_text(str(site_name_raw or ""))
    agent_name = clean_text(str(agent_name_raw or ""))
    weapon = clean_text(str(weapon_raw or ""))
    victim_agent = clean_text(str(victim_agent_raw or ""))
    headshots: Optional[int] = None
    if headshots_raw is not None:
        try:
            headshots = max(int(headshots_raw), 0)
        except (TypeError, ValueError):
            headshots = None
    if site_name.lower() == "unknown":
        site_name = ""
    if agent_name.lower() == "unknown":
        agent_name = ""
    if weapon.lower() == "unknown":
        weapon = ""
    if victim_agent.lower() == "unknown":
        victim_agent = ""

    if kills is None and not site_name and not agent_name and not weapon and headshots is None and not victim_agent:
        return None

    return {
        "sidecar_path": str(sidecar_path),
        "kills": kills,
        "site_name": site_name,
        "agent_name": agent_name,
        "weapon": weapon,
        "headshots": headshots,
        "victim_agent": victim_agent,
    }


def build_clip_focus(context: Optional[Dict[str, Any]]) -> str:
    """Build a human-readable focus string from clip context."""
    if not context:
        return ""
    kills = context.get("kills")
    site_name = clean_text(str(context.get("site_name") or ""))
    agent_name = clean_text(str(context.get("agent_name") or ""))
    weapon = clean_text(str(context.get("weapon") or ""))
    parts: List[str] = []
    if kills:
        kill_word = "Kill" if int(kills) == 1 else "Kills"
        parts.append(f"{kills} {kill_word}")
    if site_name:
        parts.append(f"on {site_name}")
    if agent_name:
        parts.append(f"with {agent_name}")
    if weapon:
        parts.append(f"using {weapon}")
    return clean_text(" ".join(parts))


def build_fallback_metadata(
    file_path: Path,
    extra_keywords: List[str],
    clip_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Generate template-based metadata when AI is unavailable."""
    base_name = file_path.stem.replace("_", " ")
    base_name = re.sub(r"[-]+", " ", base_name)
    base_name = clean_text(base_name)
    focus = build_clip_focus(clip_context)
    if focus:
        title = f"{focus} | Valorant Shorts"
        description = (
            f"VALORANT short featuring {focus.lower()}.\n"
            f"Clip source: {base_name}.\n"
            "More clutch and aim clips coming daily."
        )
    else:
        title = f"{base_name} | Valorant Shorts"
        description = (
            f"Clean VALORANT clip from session: {base_name}.\n"
            "More clutch and aim clips coming daily.\n"
            "Like + subscribe for consistent highlights."
        )
    tags = ["valorant", "valorant clips", "valorant shorts", "fps", "gaming", "valorant gameplay"]
    if clip_context:
        if clip_context.get("agent_name"):
            tags.append(str(clip_context["agent_name"]))
        if clip_context.get("site_name"):
            tags.append(f"{clip_context['site_name']} site")
        if clip_context.get("kills"):
            tags.append(f"{clip_context['kills']} kill")
        if clip_context.get("weapon"):
            tags.append(str(clip_context["weapon"]))
        if clip_context.get("victim_agent"):
            tags.append(str(clip_context["victim_agent"]))
        if clip_context.get("headshots"):
            tags.append("headshot")
    tags += extra_keywords
    return {
        "title": title,
        "description": description,
        "tags": tags,
        "hashtags": ["#shorts", "#valorant", "#gaming"],
        "cta": "Follow for more daily Valorant highlights.",
    }


def finalize_metadata(
    raw: Dict[str, Any],
    fallback: Dict[str, Any],
    instagram_username: str = "",
) -> Dict[str, Any]:
    """Merge AI-generated metadata with fallback, normalize tags/title.

    Returns a dict with keys: title, description, tags, hashtags, cta.
    The description includes the cta appended; cta is also returned separately
    so callers can access it independently.
    """
    title = trim_title(str(raw.get("title") or fallback["title"]))
    description = str(raw.get("description") or fallback["description"]).strip()
    cta = str(raw.get("cta") or fallback["cta"]).strip()

    raw_tags = raw.get("tags")
    tags_input = raw_tags if isinstance(raw_tags, list) else fallback["tags"]
    tags = normalize_tags([str(x) for x in tags_input])
    if "valorant" not in tags:
        tags = normalize_tags(["valorant"] + tags)
    if "shorts" not in tags:
        tags = normalize_tags(tags + ["shorts"])

    raw_hashtags = raw.get("hashtags")
    hashtags_input = raw_hashtags if isinstance(raw_hashtags, list) else fallback["hashtags"]
    hashtags: List[str] = []
    seen: set = set()
    for value in hashtags_input:
        tag = _normalize_hashtag_simple(str(value))
        if tag and tag not in seen:
            hashtags.append(tag)
            seen.add(tag)
    for required in ("#shorts", "#valorant"):
        if required not in seen:
            hashtags.append(required)
            seen.add(required)
    hashtags = hashtags[:5]

    lines = [description]
    if cta:
        lines.extend(["", cta])
    if hashtags:
        lines.extend(["", " ".join(hashtags)])
    insta_handle = normalize_handle(instagram_username)
    if insta_handle:
        lines.extend(["", f"Instagram: @{insta_handle}"])
    final_description = "\n".join(line.strip() for line in lines if line is not None).strip()
    if len(final_description) > 5000:
        final_description = final_description[:4999]

    return {
        "title": title,
        "description": final_description,
        "tags": tags,
        "hashtags": hashtags,
        "cta": cta,
    }


def _normalize_hashtag_simple(tag: str) -> str:
    """Normalize a hashtag: strip #, remove non-alnum, re-prefix #."""
    text = re.sub(r"[^a-zA-Z0-9_]", "", tag.replace("#", "").strip().lower())
    return f"#{text}" if text else ""


def is_metadata_unique(
    title: str,
    description: str,
    recent_titles: List[str],
    recent_descriptions: List[str],
) -> Tuple[bool, str]:
    """Check if metadata is sufficiently unique vs recent outputs.

    Uses SequenceMatcher with thresholds 0.90 (title) and 0.86 (description).
    """
    norm_title = normalize_compare_text(title)
    norm_description = normalize_compare_text(description)

    for old_title in recent_titles:
        old_norm = normalize_compare_text(old_title)
        if old_norm and old_norm == norm_title:
            return False, "exact title duplicate"
        if SequenceMatcher(None, norm_title, old_norm).ratio() >= 0.90:
            return False, "title too similar to previous upload"

    for old_description in recent_descriptions:
        old_norm = normalize_compare_text(old_description)
        if old_norm and old_norm == norm_description:
            return False, "exact description duplicate"
        if SequenceMatcher(None, norm_description, old_norm).ratio() >= 0.86:
            return False, "description too similar to previous upload"

    return True, ""


def generate_ai_metadata(
    client: Any,
    model: str,
    file_path: Path,
    rel_path: str,
    channel_name: str,
    extra_keywords: List[str],
    language: str,
    recent_titles: List[str],
    recent_descriptions: List[str],
    clip_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Generate YouTube Shorts metadata using OpenAI API."""
    system_prompt = (
        "You are a YouTube Shorts growth strategist for VALORANT content who specializes in FUNNY, VIRAL, HIGH-CTR metadata. "
        "Your goal is to make viewers laugh, relate, or feel curious enough to instantly click. "

        "You ONLY produce funny, entertaining, or ironic content. No serious esports tone.\n\n"

        "Your humor style includes:\n"
        "- Relatable gamer pain\n"
        "- Whiffs, fails, lucky shots\n"
        "- Overconfidence gone wrong\n"
        "- 'This should not have worked' moments\n"
        "- Sarcasm, exaggeration, irony\n\n"
        "- Make fun of gameplay\n\n"

        "Titles must feel like memes or inside jokes gamers instantly understand.\n"
        "Descriptions should feel like a human reacting, not describing.\n\n"

        "Avoid robotic phrasing, templates, or generic wording.\n"
        "Return ONLY strict JSON."
    )
    clip_context_text = json.dumps(clip_context, ensure_ascii=False) if clip_context else "none"
    user_prompt = (
        "Create FUNNY, HIGH-CTR metadata for a VALORANT short.\n\n"

        f"Video file name: {file_path.name}\n"
        f"Relative path: {rel_path}\n"
        f"Channel name/style: {channel_name or 'not provided'}\n"
        f"Language: {language}\n"
        f"Extra keywords: {', '.join(extra_keywords) if extra_keywords else 'none'}\n\n"

        f"Sibling sidecar JSON facts: {clip_context_text}\n\n"

        "CORE GOAL:\n"
        "- Make the viewer laugh OR say 'I need to see this'\n"
        "- Focus on relatable or absurd moments\n"
        "- Prioritize humor over skill\n\n"

        "TITLE RULES:\n"
        "- Max 100 characters\n"
        "- Must be funny, ironic, or meme-like\n"
        "- Create curiosity or confusion ('how did this happen?')\n"
        "- Use VALORANT terms naturally (ace, clutch, jett, etc.)\n"
        "- Avoid generic phrases completely\n\n"

        "HUMOR STYLES (IMPORTANT):\n"
        "- 'this should not have worked'\n"
        "- 'enemy uninstalling after this'\n"
        "- 'i did NOT deserve that'\n"
        "- 'my aim finally clocked in'\n"
        "- 'valorant logic makes no sense'\n\n"

        "DESCRIPTION RULES:\n"
        "- 2-4 short lines\n"
        "- First line = funny hook\n"
        "- Add reaction-style commentary\n"
        "- Keep it casual and human\n\n"

        "VARIETY RULE:\n"
        "- Do NOT repeat phrasing from past outputs\n"
        "- Each output should feel like a new joke\n\n"

        # Caller already slices to args.ai_uniqueness_window; defensive cap
        # here is large enough to keep the full window in most runs while
        # still bounding pathological cases.
        f"Recent titles to avoid repeating:\n{json.dumps(recent_titles[-50:], ensure_ascii=False)}\n\n"
        f"Recent descriptions to avoid repeating:\n{json.dumps(recent_descriptions[-30:], ensure_ascii=False)}\n\n"

        "Output JSON schema:\n"
        "{\n"
        '  "title": "funny, high-CTR, <=100 chars",\n'
        '  "description": "2-4 short funny lines",\n'
        '  "tags": ["10-15 relevant tags"],\n'
        '  "hashtags": ["3-5 hashtags"],\n'
        '  "cta": "short playful call-to-action"\n'
        "}\n\n"

        "STRICT RULES:\n"
        "- No emojis\n"
        "- No serious tone\n"
        "- No generic phrases\n"
        "- Use clip context if available\n"
        "- If kills = 0, treat as 1\n"
        "- Do not mention unknown info\n"
        "- Do not use round numbers\n"
        "- No Agent Name\n"
        "- No Weapon Name\n"
        "- No Flick\n"
    )
    response = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        temperature=0.8,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    raw = response.choices[0].message.content or "{}"
    return parse_json_response(raw)


def build_meta_captions(
    metadata: Dict[str, Any],
    youtube_username: str = "",
    instagram_username: str = "",
) -> Tuple[str, str, str]:
    """Build platform-specific captions for IG and FB crosspost.

    Returns (ig_caption, fb_description, fb_title).
    IG caption excludes hashtags (hashtags inflate character count and reduce reach).
    FB description includes hashtags.
    """
    title = clean_text(str(metadata.get("title", "")))
    description = str(metadata.get("description", "")).strip()

    if description:
        ig_caption = description
        if title and title.lower() not in description.lower():
            ig_caption = f"{title}\n\n{description}"
        fb_description = description
    else:
        ig_caption = title
        fb_description = title

    youtube_handle = normalize_handle(youtube_username)
    if youtube_handle:
        promo_line = f"YouTube: @{youtube_handle}"
        ig_caption = f"{ig_caption}\n\n{promo_line}".strip()

    footer_lines: List[str] = []
    insta_handle = normalize_handle(instagram_username)
    if insta_handle:
        footer_lines.append(f"Instagram: @{insta_handle}")
    if youtube_handle:
        footer_lines.append(f"YouTube: @{youtube_handle}")
    if footer_lines:
        fb_description = f"{fb_description}\n\n" + "\n".join(footer_lines)

    return ig_caption[:2200].rstrip(), fb_description[:5000].rstrip(), title[:255].rstrip()
