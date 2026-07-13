import json
from unittest.mock import patch

from app.core.config import settings
from app.services.llm_client import LLMClient


def _payload():
    return {
        "candidate": {"id": "candidate-1", "name": "Rafaela Favaro", "handle": "rafaelavfavaro"},
        "post": {
            "id": "post-1",
            "caption": "A candidata critica uma promessa nao cumprida pelo prefeito.",
            "image_context": "Rafaela fala para a camera sobre uma obra abandonada.",
        },
        "comments": [
            {
                "comment_id": "comment-1",
                "text": "Esse prefeito de TikTok nao fez nada. Voce tem razao, Rafaela!",
                "author_username": "eleitor",
                "likes": 10,
            }
        ],
    }


def test_internal_analysis_v2_requires_key(client):
    settings.INTERNAL_ANALYSIS_API_KEY = "test-internal-key"
    response = client.post("/api/v1/internal/analysis/v2", json=_payload())
    assert response.status_code == 401


def test_internal_analysis_v2_returns_candidate_stance(client):
    settings.INTERNAL_ANALYSIS_API_KEY = "test-internal-key"
    result = {
        "comment_id": "comment-1",
        "score_0_10": 9.0,
        "stance_score_0_10": 9.0,
        "general_sentiment_score_0_10": 2.5,
        "polarity": 0.8,
        "stance_label": "support",
        "target_entity": "opponent",
        "target_name": "prefeito",
        "agreement_with_post": True,
        "relevance": 0.95,
        "intensity": 0.8,
        "emotions": ["raiva"],
        "topics": ["gestao"],
        "sarcasm": False,
        "summary_pt": "Critica o prefeito e apoia Rafaela",
        "confidence": 0.94,
        "needs_review": False,
        "model": "test-model",
        "prompt_version": "political-context-v2",
    }
    with patch("app.routers.internal_analysis.LLMClient") as client_class:
        instance = client_class.return_value
        instance.model = "test-model"
        instance.analyze_political_comments_v2.return_value = iter([result])
        response = client.post(
            "/api/v1/internal/analysis/v2",
            headers={"X-Internal-Analysis-Key": "test-internal-key"},
            json=_payload(),
        )
    assert response.status_code == 200
    body = response.json()
    assert body["engine_version"] == "political-context-v2"
    assert body["items"][0]["stance_score_0_10"] == 9.0
    assert body["items"][0]["general_sentiment_score_0_10"] == 2.5
    assert body["items"][0]["target_entity"] == "opponent"


def test_parser_preserves_valid_items_when_one_item_has_missing_score():
    llm = object.__new__(LLMClient)
    llm.model = "test-model"
    response = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "items": [
                                {
                                    "comment_id": "valid",
                                    "general_sentiment_score_0_10": 8,
                                    "stance_score_0_10": 9,
                                    "stance_label": "support",
                                },
                                {
                                    "comment_id": "invalid",
                                    "general_sentiment_score_0_10": 4,
                                    "stance_label": "unclear",
                                },
                            ]
                        }
                    )
                }
            }
        ]
    }

    items = llm._parse_political_v2_response(response, ["valid", "invalid"])

    assert items[0]["score_0_10"] == 9
    assert items[1]["score_0_10"] is None
    assert items[1]["needs_review"] is True


def test_political_analysis_splits_batch_after_malformed_json():
    llm = object.__new__(LLMClient)
    llm.model = "test-model"
    llm.cost_per_1k_input = 0
    llm.cost_per_1k_output = 0
    invalid = {"choices": [{"message": {"content": "{"}}], "usage": {}}
    valid_content = json.dumps(
        {
            "items": [
                {"comment_id": "one", "general_sentiment_score_0_10": 8, "stance_score_0_10": 9},
                {"comment_id": "two", "general_sentiment_score_0_10": 2, "stance_score_0_10": 1},
            ]
        }
    )
    valid = {"choices": [{"message": {"content": valid_content}}], "usage": {}}
    comments = [{"comment_id": "one", "text": "apoio"}, {"comment_id": "two", "text": "rejeicao"}]

    with patch("app.services.llm_client.time.sleep"), patch.object(
        llm, "_call_llm", side_effect=[invalid, invalid, valid, valid]
    ) as call:
        items = list(llm.analyze_political_comments_v2(comments, {}))

    assert call.call_count == 4
    assert [item["comment_id"] for item in items] == ["one", "two"]
    assert [item["score_0_10"] for item in items] == [9, 1]
