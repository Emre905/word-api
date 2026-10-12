import os
from datetime import date

os.environ["DATABASE_URL"] = "sqlite:///./data/test_notes_app.db"

from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_bulk_note_import_parses_csv_rows_and_maps_fields():
    # Ensure the database starts clean for this test.
    main.Base.metadata.drop_all(bind=main.engine)
    main.Base.metadata.create_all(bind=main.engine)

    csv_payload = """Word,Meaning,Context,Category,Created time
pakartoti,repeat,prašau pakartoti,"essential, noun","May 22, 2024 7:30 PM"
demesio,attention,praušau demesio,"essential, noun","May 22, 2024 7:30 PM"
"""

    response = client.post("/api/notes/bulk", json={"csv": csv_payload, "with_header": True})

    assert response.status_code == 201, response.text
    payload = response.json()
    assert len(payload) == 2
    assert payload[0]["title"] == "pakartoti"
    assert payload[0]["meaning"] == "repeat"
    assert payload[0]["note_text"] == "prašau pakartoti"
    assert payload[0]["tags"] == "essential, noun"
    assert payload[0]["note_date"] == "2024-05-22"

    assert payload[1]["title"] == "demesio"
    assert payload[1]["meaning"] == "attention"
    assert payload[1]["note_text"] == "praušau demesio"

    note_count = client.get("/api/notes").json()
    assert len(note_count) == 2


def test_bulk_note_import_supports_headerless_rows():
    main.Base.metadata.drop_all(bind=main.engine)
    main.Base.metadata.create_all(bind=main.engine)

    csv_payload = """pakartoti,repeat,prašau pakartoti,"essential, noun","May 22, 2024 7:30 PM"
demesio,attention,praušau demesio,"essential, noun","May 22, 2024 7:30 PM"
"""

    response = client.post("/api/notes/bulk", json={"csv": csv_payload, "with_header": False})

    assert response.status_code == 201, response.text
    payload = response.json()
    assert len(payload) == 2
    assert payload[0]["title"] == "pakartoti"
    assert payload[0]["meaning"] == "repeat"
    assert payload[0]["note_text"] == "prašau pakartoti"
    assert payload[0]["tags"] == "essential, noun"
    assert payload[0]["note_date"] == "2024-05-22"


def test_bulk_note_import_allows_empty_context_or_category_cells():
    main.Base.metadata.drop_all(bind=main.engine)
    main.Base.metadata.create_all(bind=main.engine)

    csv_payload = """traukti/traukia/traukė,to pull,traukiu draugo automobilį,"ia/ė, ką, verb","May 30, 2024 9:52 PM"
stumti/stumia/stūmė,to push,,"ia/ė, ką, verb","May 30, 2024 9:53 PM"
"""

    response = client.post("/api/notes/bulk", json={"csv": csv_payload, "with_header": False})

    assert response.status_code == 201, response.text
    payload = response.json()
    assert len(payload) == 2
    assert payload[0]["title"] == "traukti/traukia/traukė"
    assert payload[0]["note_text"] == "traukiu draugo automobilį"
    assert payload[1]["title"] == "stumti/stumia/stūmė"
    assert payload[1]["note_text"] == ""
    assert payload[1]["tags"] == "ia/ė, ką, verb"


def test_note_creation_allows_blank_note_text_when_title_and_meaning_are_present():
    main.Base.metadata.drop_all(bind=main.engine)
    main.Base.metadata.create_all(bind=main.engine)

    response = client.post("/api/notes", json={"title": "Synonym", "meaning": "example"})

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["title"] == "Synonym"
    assert payload["meaning"] == "example"
    assert payload["note_text"] == ""
    assert payload["note_date"] == date.today().isoformat()


def test_note_creation_uses_today_when_note_date_is_missing_or_blank():
    main.Base.metadata.drop_all(bind=main.engine)
    main.Base.metadata.create_all(bind=main.engine)

    response = client.post("/api/notes", json={"title": "Today", "meaning": "now", "note_date": ""})

    assert response.status_code == 201, response.text
    assert response.json()["note_date"] == date.today().isoformat()
