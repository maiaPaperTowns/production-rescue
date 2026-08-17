"""Thin wrapper around the Google Gen AI SDK. Gemini is used for two things
only: (1) turning a free-text disruption report into structured JSON, and
(2) turning a structured recommendation + impact numbers into a short English
explanation. It never performs scheduling math itself.

If no API key is configured, or the call fails for any reason, callers get a
deterministic mock/fallback so the rest of the app (and the demo) keeps working.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.schemas.disruption import DisruptionExtractionResult, DisruptionItem

logger = logging.getLogger(__name__)
settings = get_settings()


def _generate_content_with_retry(client, **kwargs):
    """Gemini occasionally returns a transient 503 (capacity) even on a
    perfectly valid request; retry those briefly before giving up. A 404/400
    (bad model name, bad request) is not transient and fails fast instead."""
    from google.genai import errors

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=6),
        retry=retry_if_exception_type(errors.ServerError),
        reraise=True,
    )
    def _call():
        return client.models.generate_content(**kwargs)

    return _call()

_client = None
_client_init_attempted = False

DISRUPTION_SYSTEM_PROMPT = """You are the disruption-intake module for Production Rescue, an AI Assistant \
Director for film production. A production team member has reported something that changed. Extract every \
distinct disruption mentioned into structured JSON.

Disruption types you may use, exactly as written:
- "weather": a weather condition affecting exterior work. Fields: condition, start_time, end_time (24h "HH:MM"; \
  infer a specific range from words like "morning"/"afternoon"/"tomorrow" using 06:00-12:00 / 12:00-18:00 if no \
  explicit time is given), affects (e.g. ["exterior_scenes"]).
- "actor_availability": an actor's availability changed. Fields: actor (name as mentioned), available_until \
  and/or available_from (24h "HH:MM").
- "equipment_delay": a piece of equipment is delayed. Fields: equipment (name as mentioned), available_after \
  (24h "HH:MM").
- "location_unavailable": a location was lost or restricted. Fields: location (name as mentioned), \
  unavailable_start, unavailable_end (24h "HH:MM"; omit both if unavailable for the entire day).

Only extract disruptions that are explicitly stated or strongly implied by the message — never invent an actor, \
location, or equipment name that was not mentioned. Convert all times to 24-hour "HH:MM". Also return a one \
sentence, plain-English `summary` of what changed."""


def _get_client():
    global _client, _client_init_attempted
    if _client_init_attempted:
        return _client
    _client_init_attempted = True
    if not settings.gemini_configured:
        return None
    try:
        from google import genai
        if settings.google_genai_use_vertexai:
            _client = genai.Client(vertexai=True, project=settings.google_cloud_project,
                                    location=settings.google_cloud_location)
        else:
            _client = genai.Client(api_key=settings.google_api_key)
    except Exception:
        logger.exception("Failed to initialize Gemini client")
        _client = None
    return _client


# Passing the Pydantic model class directly as response_schema breaks the installed
# google-genai SDK: Pydantic v2 renders `Optional[str]` as `{"anyOf": [{"type": "string"},
# {"type": "null"}]}`, and the SDK's schema converter assumes every "type" value is a
# plain string it can .upper(). Hand-writing the schema in Gemini's OpenAPI-style shape
# (uppercase types, "nullable" flags instead of anyOf-null unions) sidesteps that entirely.
_NULLABLE_STRING = {"type": "STRING", "nullable": True}
_DISRUPTION_ITEM_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "type": {"type": "STRING", "enum": ["weather", "actor_availability", "equipment_delay", "location_unavailable"]},
        "condition": _NULLABLE_STRING,
        "start_time": _NULLABLE_STRING,
        "end_time": _NULLABLE_STRING,
        "affects": {"type": "ARRAY", "items": {"type": "STRING"}},
        "actor": _NULLABLE_STRING,
        "available_until": _NULLABLE_STRING,
        "available_from": _NULLABLE_STRING,
        "equipment": _NULLABLE_STRING,
        "available_after": _NULLABLE_STRING,
        "location": _NULLABLE_STRING,
        "unavailable_start": _NULLABLE_STRING,
        "unavailable_end": _NULLABLE_STRING,
    },
    "required": ["type"],
}
DISRUPTION_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "disruptions": {"type": "ARRAY", "items": _DISRUPTION_ITEM_SCHEMA},
        "summary": {"type": "STRING"},
    },
    "required": ["disruptions", "summary"],
}


def parse_disruption_text(raw_text: str, known_names: Optional[dict] = None) -> DisruptionExtractionResult:
    client = _get_client()
    if client is None:
        return _mock_parse(raw_text, known_names or {})

    try:
        from google.genai import types
        response = _generate_content_with_retry(
            client,
            model=settings.gemini_model,
            contents=f"{DISRUPTION_SYSTEM_PROMPT}\n\nProduction team message:\n\"\"\"{raw_text}\"\"\"",
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DISRUPTION_RESPONSE_SCHEMA,
                temperature=0.1,
            ),
        )
        result = DisruptionExtractionResult.model_validate_json(response.text)
        result.source = "gemini"
        return result
    except Exception:
        logger.exception("Gemini disruption parse failed; falling back to mock parser")
        return _mock_parse(raw_text, known_names or {})


def explain_recommendation(
    disruption_summary: str,
    plan_description: str,
    impact_summary: str,
) -> str:
    """Turn structured plan + impact facts into the 2-3 sentence 'Why this plan?'
    explanation shown to the human approver. Never asked to invent numbers —
    only to phrase ones we already computed."""
    client = _get_client()
    if client is None:
        return _mock_explanation(plan_description, impact_summary)

    prompt = (
        "You are the AI Assistant Director for a film production. In 2-3 sentences, explain to a human "
        "Assistant Director why the following rescue schedule is recommended. Be concrete and operational, "
        "referencing the specific changes and constraints below. Do not invent any numbers or facts beyond "
        "what is given. Do not use markdown.\n\n"
        f"Disruption: {disruption_summary}\n\nProposed plan: {plan_description}\n\nImpact: {impact_summary}"
    )
    try:
        response = _generate_content_with_retry(client, model=settings.gemini_model, contents=prompt)
        text = (response.text or "").strip()
        return text or _mock_explanation(plan_description, impact_summary)
    except Exception:
        logger.exception("Gemini explanation generation failed; falling back to templated summary")
        return _mock_explanation(plan_description, impact_summary)


# ---------------------------------------------------------------------------
# Deterministic fallbacks (also what powers NEXT_PUBLIC_DEMO_MODE reliably)
# ---------------------------------------------------------------------------

_TIME_RANGE_RE = re.compile(
    r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to|until|–)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", re.IGNORECASE
)
_SINGLE_TIME_RE = re.compile(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b", re.IGNORECASE)


def _infer_meridiem(hour: int) -> str:
    """Bare numbers in casual production chatter ('leave at 2', 'until 3')
    almost always mean afternoon on a working shoot day; small hours are the
    exception, not the rule."""
    return "pm" if 1 <= hour <= 7 else "am"


def _to_24h(hour: int, minute: int, meridiem: Optional[str]) -> str:
    if meridiem:
        meridiem = meridiem.lower()
        if meridiem == "pm" and hour != 12:
            hour += 12
        if meridiem == "am" and hour == 12:
            hour = 0
    return f"{hour:02d}:{minute:02d}"


def _find_name(text: str, candidates: list[str], allow_first_word: bool = False) -> Optional[str]:
    """Match a known full name against production shorthand. Equipment and
    locations are almost always referenced by their complete designation
    ("Camera B", "Stage C") so those require a full match — a first-word-only
    match would confuse "Camera A" with "Camera B". People are commonly
    referred to by first name only, so `allow_first_word` relaxes that for actors."""
    lowered = text.lower()
    for name in candidates:
        pattern = r"\b" + r"\s*".join(re.escape(w.lower()) for w in name.split()) + r"\b"
        if re.search(pattern, lowered):
            return name
    if allow_first_word:
        for name in candidates:
            first = name.split()[0]
            if len(first) >= 3 and re.search(rf"\b{re.escape(first.lower())}\b", lowered):
                return name
    return None


def _find_all_names(text: str, candidates: list[str], allow_first_word: bool = False) -> list[str]:
    """Like _find_name but returns every distinct candidate mentioned, so a
    single message can report disruptions to more than one actor, location,
    or equipment item of the same type."""
    found = []
    for name in candidates:
        if _find_name(text, [name], allow_first_word=allow_first_word):
            found.append(name)
    return found


def _nearby_time(raw_text: str, matched_name: str) -> Optional[re.Match]:
    """Search for a time expression starting from wherever `matched_name`
    (or its first word) actually appears in the text, so we don't grab an
    unrelated time mentioned earlier in the message."""
    lowered = raw_text.lower()
    idx = lowered.find(matched_name.split()[0].lower())
    window = raw_text[idx:] if idx >= 0 else raw_text
    return _SINGLE_TIME_RE.search(window) or _SINGLE_TIME_RE.search(raw_text)


def _mock_parse(raw_text: str, known_names: dict) -> DisruptionExtractionResult:
    """Deterministic keyword/regex extraction used when Gemini isn't configured
    or fails. Tuned for the hackathon demo's disruption phrasing, but general
    enough to handle reasonable variations."""
    text = raw_text.lower()
    disruptions: list[DisruptionItem] = []

    if any(w in text for w in ["thunderstorm", "storm", "rain", "weather"]):
        match = _TIME_RANGE_RE.search(raw_text)
        if match:
            h1, m1, mer1, h2, m2, mer2 = match.groups()
            mer1 = mer1 or mer2
            mer2 = mer2 or mer1
            start = _to_24h(int(h1), int(m1 or 0), mer1)
            end = _to_24h(int(h2), int(m2 or 0), mer2)
        elif "afternoon" in text:
            start, end = "11:00", "17:00"
        elif "morning" in text:
            start, end = "06:00", "12:00"
        else:
            start, end = "11:00", "17:00"
        condition = "thunderstorm" if "thunder" in text or "storm" in text else ("rain" if "rain" in text else "weather")
        disruptions.append(DisruptionItem(type="weather", condition=condition, start_time=start, end_time=end,
                                           affects=["exterior_scenes"]))

    actor_names = known_names.get("actors", [])
    if any(w in text for w in ["leave", "available", "wrap", "unavailable", "out by", "depart"]):
        for actor_name in _find_all_names(raw_text, actor_names, allow_first_word=True):
            time_match = _nearby_time(raw_text, actor_name)
            if time_match:
                h, mnt, mer = time_match.groups()
                until = _to_24h(int(h), int(mnt or 0), mer or _infer_meridiem(int(h)))
            elif "all day" in text or "unavailable" in text or "out today" in text:
                until = "00:00"  # no time mentioned + "unavailable" implies unavailable for the whole day
            else:
                continue
            disruptions.append(DisruptionItem(type="actor_availability", actor=actor_name, available_until=until))

    equipment_names = known_names.get("equipment", [])
    if any(w in text for w in ["delay", "delayed", "arrive", "won't arrive", "not arrive", "late"]):
        for equipment_name in _find_all_names(raw_text, equipment_names):
            time_match = _nearby_time(raw_text, equipment_name)
            if time_match:
                h, mnt, mer = time_match.groups()
                after = _to_24h(int(h), int(mnt or 0), mer or _infer_meridiem(int(h)))
                disruptions.append(DisruptionItem(type="equipment_delay", equipment=equipment_name, available_after=after))

    location_names = known_names.get("locations", [])
    if any(w in text for w in ["lost", "cancel", "unavailable", "closed", "permit"]):
        for location_name in _find_all_names(raw_text, location_names):
            disruptions.append(DisruptionItem(type="location_unavailable", location=location_name))

    summary = "; ".join(
        d.condition and f"{d.condition} {d.start_time}-{d.end_time}"
        or d.actor and f"{d.actor} unavailable after {d.available_until}"
        or d.equipment and f"{d.equipment} delayed until {d.available_after}"
        or d.location and f"{d.location} unavailable"
        for d in disruptions
    ) or "No structured disruptions could be extracted from this message."

    return DisruptionExtractionResult(disruptions=disruptions, summary=summary, source="mock")


def _mock_explanation(plan_description: str, impact_summary: str) -> str:
    return (
        f"This plan was selected because it satisfies every hard production constraint while preserving as much "
        f"of the original shooting order as possible. {plan_description} {impact_summary}"
    ).strip()
