def test_web_analytics_captures_pageview_without_cookie(client, monkeypatch):
    captured = []

    monkeypatch.setattr(
        "app.routers.analytics.capture",
        lambda distinct_id, event, properties: captured.append((distinct_id, event, properties)),
    )

    res = client.post(
        "/api/v1/analytics/web",
        json={
            "type": "page_view",
            "path": "/diagnostico",
            "url": "https://sentimenta.com.br/diagnostico?utm_source=google&utm_medium=cpc&email=secret@example.com",
            "title": "Diagnostico",
            "referrer": "https://www.google.com/search?q=sentimenta",
            "consent_state": "pending",
            "client_telemetry_id": "client-session-1",
            "attribution": {"utm_source": "google", "utm_medium": "cpc", "client_telemetry_id": "client-session-1"},
            "properties": {"viewport_width": 390},
        },
    )

    assert res.status_code == 202
    assert len(captured) == 1
    distinct_id, event, props = captured[0]
    assert distinct_id.startswith("web:")
    assert event == "$pageview"
    assert props["tracking_mode"] == "first_party_server"
    assert props["consent_state"] == "pending"
    assert props["attr_utm_source"] == "google"
    assert "email=" not in props["$current_url"]
    assert props["$current_url"] == "https://sentimenta.com.br/diagnostico?utm_source=google&utm_medium=cpc"


def test_web_analytics_captures_click_target(client, monkeypatch):
    captured = []

    monkeypatch.setattr(
        "app.routers.analytics.capture",
        lambda distinct_id, event, properties: captured.append((distinct_id, event, properties)),
    )

    res = client.post(
        "/api/v1/analytics/web",
        json={
            "type": "click",
            "path": "/",
            "url": "https://sentimenta.com.br/?utm_campaign=pmax_diagnostico",
            "consent_state": "declined",
            "client_telemetry_id": "client-session-2",
            "target": {
                "tag": "a",
                "label": "Pedir diagnostico com user@example.com",
                "href_path": "/diagnostico?utm_source=google",
            },
        },
    )

    assert res.status_code == 202
    assert len(captured) == 1
    _, event, props = captured[0]
    assert event == "web_click"
    assert props["target_tag"] == "a"
    assert props["target_label"] == "Pedir diagnostico com [email]"
    assert props["target_href_path"] == "/diagnostico"
    assert props["consent_state"] == "declined"


def test_web_analytics_uses_authenticated_user_when_available(client, auth_headers, test_user, monkeypatch):
    user, _ = test_user
    captured = []

    monkeypatch.setattr(
        "app.routers.analytics.capture",
        lambda distinct_id, event, properties: captured.append((distinct_id, event, properties)),
    )

    res = client.post(
        "/api/v1/analytics/web",
        headers=auth_headers,
        json={
            "type": "custom",
            "event": "post_clicked",
            "path": "/dashboard",
            "url": "https://sentimenta.com.br/dashboard",
            "consent_state": "accepted",
            "client_telemetry_id": "client-session-3",
            "properties": {"post_id": "abc"},
        },
    )

    assert res.status_code == 202
    assert len(captured) == 1
    distinct_id, event, props = captured[0]
    assert distinct_id == str(user.id)
    assert event == "post_clicked"
    assert props["distinct_source"] == "authenticated_user"
    assert props["is_authenticated"] is True
