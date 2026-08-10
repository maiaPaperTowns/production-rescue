"""Tests for the disruption intake layer. No GOOGLE_API_KEY is set in the test
environment, so these exercise the deterministic mock fallback — the same path
that powers NEXT_PUBLIC_DEMO_MODE when no Gemini credentials are configured."""
from app.services.gemini_service import parse_disruption_text
from app.services.scheduling_service import build_day_context, disruption_items_to_parsed

KNOWN_NAMES = {
    "actors": ["Maya Chen", "Daniel Ortiz", "Sarah Kim"],
    "equipment": ["Camera A", "Camera B", "Drone", "Vehicle Rig"],
    "locations": ["Riverside Park", "Downtown Street", "Stage B", "Stage C"],
}


def test_parses_canonical_demo_sentence_with_explicit_times():
    text = "Thunderstorms are expected 11am-5pm and Maya must leave by 2pm. Camera B delivery is delayed until 3pm."
    result = parse_disruption_text(text, KNOWN_NAMES)
    assert result.source == "mock"
    by_type = {d.type: d for d in result.disruptions}

    assert by_type["weather"].start_time == "11:00"
    assert by_type["weather"].end_time == "17:00"
    assert by_type["actor_availability"].actor == "Maya Chen"
    assert by_type["actor_availability"].available_until == "14:00"
    assert by_type["equipment_delay"].equipment == "Camera B"
    assert by_type["equipment_delay"].available_after == "15:00"


def test_parses_spec_example_phrasing_without_am_pm_markers():
    text = "Thunderstorms tomorrow afternoon. Maya needs to leave at 2 and Camera B won't arrive until 3."
    result = parse_disruption_text(text, KNOWN_NAMES)
    by_type = {d.type: d for d in result.disruptions}

    assert by_type["actor_availability"].available_until == "14:00"
    assert by_type["equipment_delay"].available_after == "15:00"


def test_does_not_confuse_camera_a_and_camera_b():
    result = parse_disruption_text("Camera B is delayed until 4pm.", KNOWN_NAMES)
    equipment = next(d for d in result.disruptions if d.type == "equipment_delay")
    assert equipment.equipment == "Camera B"

    result_a = parse_disruption_text("Camera A is delayed until 4pm.", KNOWN_NAMES)
    equipment_a = next(d for d in result_a.disruptions if d.type == "equipment_delay")
    assert equipment_a.equipment == "Camera A"


def test_location_unavailable_extraction():
    result = parse_disruption_text("Riverside Park lost its permit for today.", KNOWN_NAMES)
    location = next(d for d in result.disruptions if d.type == "location_unavailable")
    assert location.location == "Riverside Park"


def test_no_disruptions_extracted_from_irrelevant_text():
    result = parse_disruption_text("Craft services ran out of coffee.", KNOWN_NAMES)
    assert result.disruptions == []


def test_parsed_disruptions_feed_directly_into_the_solver(seeded_day18):
    text = "Thunderstorms are expected 11am-5pm and Maya must leave by 2pm. Camera B delivery is delayed until 3pm."
    result = parse_disruption_text(text, KNOWN_NAMES)
    parsed = disruption_items_to_parsed(result.disruptions)

    context = build_day_context(seeded_day18["db"], seeded_day18["day"].id, parsed)
    maya = seeded_day18["actors"]["maya"]
    assert context.actor_windows[maya.id] == [(420, 840)]  # 07:00-14:00
    assert context.weather_blackouts == [(660, 1020)]  # 11:00-17:00
