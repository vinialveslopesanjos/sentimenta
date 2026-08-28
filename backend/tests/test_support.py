from app.models.support_ticket import SupportTicket


def _payload(category: str = "data_trust") -> dict:
    return {
        "name": "Pessoa QA",
        "email": "pessoa.qa@example.com",
        "category": category,
        "subject": "Não entendi a origem do score",
        "message": "Quero saber quais comentários entraram na leitura.",
        "source_path": "/dashboard",
    }


def test_support_ticket_is_persisted_before_email_notification(client, db, monkeypatch):
    monkeypatch.setattr("app.routers.support.send_support_contact_email", lambda **_: False)

    res = client.post("/api/v1/support/contact", json=_payload())

    assert res.status_code == 200
    assert res.json()["email_sent"] is False
    ticket = db.query(SupportTicket).one()
    assert ticket.category == "data_trust"
    assert ticket.source_path == "/dashboard"
    assert ticket.email_error == "send_support_contact_email returned false"


def test_support_ticket_survives_notification_exception(client, db, monkeypatch):
    def fail(**_):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr("app.routers.support.send_support_contact_email", fail)

    res = client.post("/api/v1/support/contact", json=_payload("collection_sync"))

    assert res.status_code == 200
    assert res.json()["email_sent"] is False
    ticket = db.query(SupportTicket).one()
    assert ticket.category == "collection_sync"
    assert ticket.email_error == "RuntimeError"


def test_support_ticket_records_successful_notification(client, db, monkeypatch):
    monkeypatch.setattr("app.routers.support.send_support_contact_email", lambda **_: True)

    res = client.post("/api/v1/support/contact", json=_payload("billing"))

    assert res.status_code == 200
    assert res.json()["email_sent"] is True
    ticket = db.query(SupportTicket).one()
    assert ticket.category == "billing"
    assert ticket.email_sent_at is not None


def test_support_ticket_is_rate_limited_by_ip_and_email(client, monkeypatch):
    calls = []

    def fake_check(key, max_requests, window_seconds):
        calls.append((key, max_requests, window_seconds))

    monkeypatch.setattr("app.middleware.rate_limiter.rate_limiter.check", fake_check)
    monkeypatch.setattr("app.routers.support.send_support_contact_email", lambda **_: False)

    res = client.post("/api/v1/support/contact", json=_payload())

    assert res.status_code == 200
    assert calls == [
        ("support:ip:testclient", 8, 3600),
        ("support:email:pessoa.qa@example.com", 3, 86400),
    ]


def test_support_referer_is_truncated_before_persistence(client, db, monkeypatch):
    monkeypatch.setattr("app.routers.support.send_support_contact_email", lambda **_: False)
    payload = _payload()
    payload.pop("source_path")

    res = client.post(
        "/api/v1/support/contact",
        json=payload,
        headers={"referer": "https://example.test/" + ("x" * 700)},
    )

    assert res.status_code == 200
    ticket = db.query(SupportTicket).one()
    assert len(ticket.source_path or "") == 500
