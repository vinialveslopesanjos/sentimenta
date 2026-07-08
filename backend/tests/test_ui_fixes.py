"""Catadão UI 07/07 — compare-connections inclui conexões sem dados."""


def test_compare_connections_includes_empty_connection(client, auth_headers, test_connection):
    res = client.get(
        f"/api/v1/dashboard/compare-connections?connection_ids={test_connection.id}&days=3650",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    ids = [c["connection_id"] for c in data["connections"]]
    # Conexão sem nenhum comentário aparece com zeros, não some
    assert str(test_connection.id) in ids
    row = data["connections"][0]
    assert row["total_comments"] == 0
    assert row["total_analyzed"] == 0
