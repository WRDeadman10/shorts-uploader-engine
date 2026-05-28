"""AI metadata generation — clip context, fallback metadata, OpenAI integration.

Generates YouTube Shorts metadata using OpenAI API or falls back to
template-based metadata from sidecar JSON files.
"""
from __future__ import annotations

import json
import re
import copy
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from lib.file_utils import load_json_file
from lib.text_utils import (
    clean_text, get_sidecar_value, normalize_tags, trim_title,
    normalize_handle, parse_json_response, text_similarity,
    normalize_compare_text,
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
    for val_name in [site_name, agent_name, weapon, victim_agent]:
        pass  # normalization already done above
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

    # Scrub Riot IDs from raw payload
    safe_payload = copy.deepcopy(payload)
    if "round_details" in safe_payload and isinstance(safe_payload["round_details"], dict):
        kb = safe_payload["round_details"].get("kills_breakdown", [])
        if isinstance(kb, list):
            for kill in kb:
                if isinstance(kill, dict) and "victim" in kill:
                    del kill["victim"]

    return {
        "sidecar_path": str(sidecar_path),
        "kills": kills,
        "site_name": site_name,
        "agent_name": agent_name,
        "weapon": weapon,
        "headshots": headshots,
        "victim_agent": victim_agent,
        "raw_data": safe_payload,
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


def build_aggregated_clip_context(source_paths: List[Path]) -> Optional[Dict[str, Any]]:
    """Aggregate clip context from multiple source video paths."""
    aggregated: Dict[str, Any] = {
        "kills": 0,
        "site_name": "",
        "agent_name": "",
        "weapon": "",
        "headshots": 0,
        "victim_agent": "",
        "raw_data": []
    }
    found_any = False
    sites = set()
    agents = set()
    weapons = set()
    victims = set()

    for sp in source_paths:
        ctx = load_clip_context(sp)
        if ctx:
            found_any = True
            if ctx.get("kills"): aggregated["kills"] += int(ctx["kills"])
            if ctx.get("headshots"): aggregated["headshots"] += int(ctx["headshots"])
            if ctx.get("site_name"): sites.add(ctx["site_name"])
            if ctx.get("agent_name"): agents.add(ctx["agent_name"])
            if ctx.get("weapon"): weapons.add(ctx["weapon"])
            if ctx.get("victim_agent"): victims.add(ctx["victim_agent"])
            if ctx.get("raw_data"): aggregated["raw_data"].append(ctx["raw_data"])

    if not found_any:
        return None

    aggregated["site_name"] = " / ".join(sorted(sites))
    aggregated["agent_name"] = " / ".join(sorted(agents))
    aggregated["weapon"] = " / ".join(sorted(weapons))
    aggregated["victim_agent"] = " / ".join(sorted(victims))
    
    if aggregated["kills"] == 0: aggregated["kills"] = None
    if aggregated["headshots"] == 0: aggregated["headshots"] = None

    return aggregated


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
    """Merge AI-generated metadata with fallback, normalize tags/title."""
    title = trim_title(str(raw.get("title") or fallback["title"]))
    description = str(raw.get("description") or fallback["description"]).strip()
    cta = str(raw.get("cta") or fallback["cta"]).strip()

    raw_tags = raw.get("tags")
    tags_input = raw_tags if isinstance(raw_tags, list) else fallback["tags"]
    tags = normalize_tags([str(x) for x in tags_input])
    if "valorant" not in [t.lower().lstrip("#") for t in tags]:
        tags.insert(0, "valorant")

    raw_hashtags = raw.get("hashtags")
    hashtags_input = raw_hashtags if isinstance(raw_hashtags, list) else fallback["hashtags"]
    hashtags = normalize_tags([str(x) for x in hashtags_input], max_tags=5)
    if "#shorts" not in [h.lower() for h in hashtags]:
        hashtags.insert(0, "#shorts")

    if instagram_username:
        handle = normalize_handle(instagram_username)
        description += f"\n\nIG: @{handle}"

    return {
        "title": title,
        "description": f"{description}\n\n{cta}" if cta else description,
        "tags": tags,
        "hashtags": hashtags,
    }


def is_metadata_unique(
    title: str,
    description: str,
    recent_titles: List[str],
    recent_descriptions: List[str],
    threshold: float = 0.7,
) -> Tuple[bool, str]:
    """Check if metadata is sufficiently unique vs recent outputs."""
    for recent in recent_titles:
        if text_similarity(title, recent) > threshold:
            return False, f"Title too similar to recent: {recent}"
    for recent in recent_descriptions:
        if text_similarity(description, recent) > threshold:
            return False, f"Description too similar to recent: {recent}"
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
        "Output JSON schema:\n"
        '{"title": "funny <=100 chars", "description": "2-4 lines", '
        '"tags": ["10-15 tags"], "hashtags": ["3-5"], "cta": "short CTA"}\n\n'
        "RULES: No emojis, no serious tone, no generic phrases, use clip context if available.\n\n"
        f"Recent titles to avoid:\n{json.dumps(recent_titles[-5:], ensure_ascii=False)}\n"
        f"Recent descriptions to avoid:\n{json.dumps(recent_descriptions[-3:], ensure_ascii=False)}\n"
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
) -> tuple:
    """Build platform-specific captions for IG and FB crosspost.

    Returns (ig_caption, fb_description, fb_title).
    """
    title = str(metadata.get("title", ""))
    description = str(metadata.get("description", ""))
    hashtags = metadata.get("hashtags", [])
    hashtag_line = " ".join(str(h) for h in hashtags) if hashtags else ""

    ig_parts = [title]
    if description:
        ig_parts.append(description)
    if hashtag_line:
        ig_parts.append(hashtag_line)
    if youtube_username:
        yt_handle = normalize_handle(youtube_username)
        ig_parts.append(f"YT: @{yt_handle}")
    ig_caption = "\n\n".join(ig_parts)

    fb_parts = [description] if description else [title]
    if hashtag_line:
        fb_parts.append(hashtag_line)
    if instagram_username:
        ig_handle = normalize_handle(instagram_username)
        fb_parts.append(f"IG: @{ig_handle}")
    fb_description = "\n\n".join(fb_parts)
    fb_title = title

    return ig_caption, fb_description, fb_title
