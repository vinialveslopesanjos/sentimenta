"""Cost accounting must match the configured default model's current price."""

import pytest

from app.services.llm_client import LLMClient


def test_gemini_25_flash_uses_current_openrouter_token_prices():
    client = LLMClient(api_key="test", model="google/gemini-2.5-flash")

    assert client._estimate_cost(1_000_000, 1_000_000) == pytest.approx(2.80)
    assert client._estimate_cost(1_000, 1_000) == pytest.approx(0.0028)
