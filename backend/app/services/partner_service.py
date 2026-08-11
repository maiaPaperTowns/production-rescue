"""Partner integration: Parallel (parallel.ai) as the production agent's
external research layer. When a disruption involves something the production's
own data can't tell it — is a location's permit actually revoked, is there a
public event or road closure affecting a route — this is where the agent
would look outward instead of just at its own database.

This is a real service adapter: it authenticates, builds the actual Parallel
Search API request shape, validates the response, retries on transient
failures, and only falls back to a clearly-labeled mock when no
PARALLEL_API_KEY is configured or the live call fails. It never fabricates a
"real" result — a degraded/mock response is always tagged as such so callers
(and the UI) can be honest about it, per the "no invented data" requirement.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

PARALLEL_SEARCH_PATH = "/v1beta/search"
REQUEST_TIMEOUT_SECONDS = 8.0


@dataclass
class PartnerSearchResult:
    title: str
    url: str
    excerpt: str


@dataclass
class PartnerContextResult:
    query: str
    results: list[PartnerSearchResult] = field(default_factory=list)
    source: str = "mock"  # "parallel" | "mock" | "degraded"
    error: str = ""


class PartnerService:
    def __init__(self):
        self.api_key = settings.parallel_api_key
        self.base_url = settings.parallel_api_base.rstrip("/")
        self.configured = bool(self.api_key)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
        reraise=True,
    )
    def _call_api(self, query: str, max_results: int = 3) -> dict:
        response = httpx.post(
            f"{self.base_url}{PARALLEL_SEARCH_PATH}",
            headers={"x-api-key": self.api_key, "Content-Type": "application/json"},
            json={"objective": query, "search_queries": [query], "processor": "base", "max_results": max_results},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()

    def research_context(self, query: str, max_results: int = 3) -> PartnerContextResult:
        """Look up real-world context for a production disruption (permit
        status, closures, local events, transportation conditions)."""
        if not self.configured:
            return self._mock_context(query, source="mock")
        try:
            raw = self._call_api(query, max_results=max_results)
            results = self._validate_response(raw)
            return PartnerContextResult(query=query, results=results, source="parallel")
        except Exception as exc:
            logger.warning("Parallel research_context call failed for %r: %s", query, exc)
            return self._mock_context(query, source="degraded", error=str(exc))

    @staticmethod
    def _validate_response(raw: dict) -> list[PartnerSearchResult]:
        results = []
        for item in raw.get("results", []):
            excerpts = item.get("excerpts") or []
            results.append(PartnerSearchResult(
                title=str(item.get("title", "")).strip(),
                url=str(item.get("url", "")).strip(),
                excerpt=" ".join(str(e) for e in excerpts)[:400] if excerpts else str(item.get("excerpt", ""))[:400],
            ))
        return results

    @staticmethod
    def _mock_context(query: str, source: str, error: str = "") -> PartnerContextResult:
        return PartnerContextResult(
            query=query,
            results=[PartnerSearchResult(
                title="Partner research unavailable (mock/degraded mode)",
                url="",
                excerpt=(
                    f"No live Parallel API result for '{query}'. Configure PARALLEL_API_KEY to enable "
                    "real external research; production data from the schedule database was used instead."
                ),
            )],
            source=source,
            error=error,
        )


_service: PartnerService | None = None


def get_partner_service() -> PartnerService:
    global _service
    if _service is None:
        _service = PartnerService()
    return _service
