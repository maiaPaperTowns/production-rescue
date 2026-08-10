"""Pure interval-arithmetic helpers used by the constraint solver.
All times are minutes-since-midnight integers. Intervals are (start, end) tuples,
half-open [start, end), always kept sorted and non-overlapping ("normalized")
when returned from these functions.
"""
from __future__ import annotations

Interval = tuple[int, int]


def normalize(intervals: list[Interval]) -> list[Interval]:
    """Sort and merge overlapping/touching intervals."""
    cleaned = sorted((s, e) for s, e in intervals if e > s)
    if not cleaned:
        return []
    merged = [cleaned[0]]
    for s, e in cleaned[1:]:
        last_s, last_e = merged[-1]
        if s <= last_e:
            merged[-1] = (last_s, max(last_e, e))
        else:
            merged.append((s, e))
    return merged


def intersect_two(a: list[Interval], b: list[Interval]) -> list[Interval]:
    a = normalize(a)
    b = normalize(b)
    result: list[Interval] = []
    for s1, e1 in a:
        for s2, e2 in b:
            s, e = max(s1, s2), min(e1, e2)
            if s < e:
                result.append((s, e))
    return normalize(result)


def intersect_all(interval_lists: list[list[Interval]]) -> list[Interval]:
    if not interval_lists:
        return []
    acc = normalize(interval_lists[0])
    for lst in interval_lists[1:]:
        acc = intersect_two(acc, lst)
        if not acc:
            return []
    return acc


def subtract(base: list[Interval], blocked: list[Interval]) -> list[Interval]:
    """Return base minus every interval in blocked."""
    result = normalize(base)
    for b_s, b_e in normalize(blocked):
        next_result: list[Interval] = []
        for s, e in result:
            if b_e <= s or b_s >= e:
                next_result.append((s, e))
                continue
            if b_s > s:
                next_result.append((s, b_s))
            if b_e < e:
                next_result.append((b_e, e))
        result = next_result
    return normalize(result)


def earliest_fit(intervals: list[Interval], lower_bound: int, duration: int) -> int | None:
    """Earliest start time >= lower_bound such that [start, start+duration) fits
    entirely inside one of the given (already normalized) intervals."""
    for s, e in normalize(intervals):
        start = max(s, lower_bound)
        if start + duration <= e:
            return start
    return None


def overlaps(a: Interval, b: Interval) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def total_minutes(intervals: list[Interval]) -> int:
    return sum(e - s for s, e in intervals)


def fmt_hm(minutes: int) -> str:
    h, m = divmod(minutes % 1440, 60)
    return f"{h:02d}:{m:02d}"


def parse_hm(text: str) -> int:
    h, m = text.split(":")
    return int(h) * 60 + int(m)
