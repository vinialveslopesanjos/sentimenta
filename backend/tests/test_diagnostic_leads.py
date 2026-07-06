from app.models.diagnostic_lead import DiagnosticLead


def test_diagnostic_lead_is_saved_when_email_fails(client, db, monkeypatch):
    captured = []

    def fake_send_support_contact_email(**kwargs):
        return False

    monkeypatch.setattr(
        "app.routers.leads.send_support_contact_email",
        fake_send_support_contact_email,
    )
    monkeypatch.setattr(
        "app.routers.leads.capture",
        lambda distinct_id, event, properties: captured.append((distinct_id, event, properties)),
    )

    res = client.post(
        "/api/v1/leads/diagnostic",
        json={
            "name": "Lead Teste",
            "email": "lead@example.com",
            "role": "agencia",
            "profile_or_post": "@cliente_publico",
            "context": "Quero entender criticas recorrentes.",
            "source_path": "/diagnostico",
            "attribution": {"utm_source": "instagram", "utm_campaign": "first_100"},
        },
    )

    assert res.status_code == 200
    payload = res.json()
    assert payload["email_sent"] is False
    assert payload["id"]

    lead = db.query(DiagnosticLead).filter(DiagnosticLead.email == "lead@example.com").one()
    assert lead.name == "Lead Teste"
    assert lead.role == "agencia"
    assert lead.profile_or_post == "@cliente_publico"
    assert lead.attribution == {"utm_source": "instagram", "utm_campaign": "first_100"}
    assert lead.email_sent_at is None
    assert lead.email_error == "send_support_contact_email returned false"
    assert len(captured) == 1
    distinct_id, event, props = captured[0]
    assert distinct_id.startswith("lead:")
    assert event == "diagnostic_request_submitted"
    assert props["source"] == "sentimenta_backend"
    assert props["tracking_mode"] == "first_party_server"
    assert props["event_type"] == "conversion"
    assert props["conversion_name"] == "diagnostic_request"
    assert props["lead_id"] == str(lead.id)
    assert props["email_domain"] == "example.com"
    assert props["attr_utm_source"] == "instagram"


def test_diagnostic_lead_marks_email_sent(client, db, monkeypatch):
    def fake_send_support_contact_email(**kwargs):
        return True

    monkeypatch.setattr(
        "app.routers.leads.send_support_contact_email",
        fake_send_support_contact_email,
    )

    res = client.post(
        "/api/v1/leads/diagnostic",
        json={
            "name": "Lead Email",
            "email": "lead-email@example.com",
            "role": "social-media",
            "profile_or_post": "https://instagram.com/p/test",
        },
    )

    assert res.status_code == 200
    assert res.json()["email_sent"] is True

    lead = db.query(DiagnosticLead).filter(DiagnosticLead.email == "lead-email@example.com").one()
    assert lead.email_sent_at is not None
    assert lead.email_error is None


def test_diagnostic_lead_rejects_honeypot(client, db):
    res = client.post(
        "/api/v1/leads/diagnostic",
        json={
            "name": "Bot",
            "email": "bot@example.com",
            "role": "agencia",
            "profile_or_post": "@spam",
            "website": "https://spam.example",
        },
    )

    assert res.status_code == 400
    assert db.query(DiagnosticLead).count() == 0


def test_diagnostic_lead_is_rate_limited_by_email(client, monkeypatch):
    def fake_send_support_contact_email(**kwargs):
        return True

    monkeypatch.setattr(
        "app.routers.leads.send_support_contact_email",
        fake_send_support_contact_email,
    )

    payload = {
        "name": "Lead Rate",
        "email": "lead-rate@example.com",
        "role": "agencia",
        "profile_or_post": "@cliente",
    }

    for _ in range(3):
        res = client.post("/api/v1/leads/diagnostic", json=payload)
        assert res.status_code == 200

    limited = client.post("/api/v1/leads/diagnostic", json=payload)
    assert limited.status_code == 429
