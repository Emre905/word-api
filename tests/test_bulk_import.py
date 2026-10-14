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
    assert payload[0]["word"] == "pakartoti"
    assert payload[0]["meaning"] == "repeat"
    assert payload[0]["context"] == "prašau pakartoti"
    assert payload[0]["tags"] == "essential, noun"
    assert payload[0]["note_date"] == "2024-05-22"

    assert payload[1]["word"] == "demesio"
    assert payload[1]["meaning"] == "attention"
    assert payload[1]["context"] == "praušau demesio"

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
    assert payload[0]["word"] == "pakartoti"
    assert payload[0]["meaning"] == "repeat"
    assert payload[0]["context"] == "prašau pakartoti"
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
    assert payload[0]["word"] == "traukti/traukia/traukė"
    assert payload[0]["context"] == "traukiu draugo automobilį"
    assert payload[1]["word"] == "stumti/stumia/stūmė"
    assert payload[1]["context"] == ""
    assert payload[1]["tags"] == "ia/ė, ką, verb"


def test_note_creation_allows_blank_note_text_when_word_and_meaning_are_present():
    main.Base.metadata.drop_all(bind=main.engine)
    main.Base.metadata.create_all(bind=main.engine)

    response = client.post("/api/notes", json={"word": "Synonym", "meaning": "example"})

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["word"] == "Synonym"
    assert payload["meaning"] == "example"
    assert payload["context"] == ""
    assert payload["note_date"] == date.today().isoformat()


def test_note_creation_uses_today_when_note_date_is_missing_or_blank():
    main.Base.metadata.drop_all(bind=main.engine)
    main.Base.metadata.create_all(bind=main.engine)

    response = client.post("/api/notes", json={"word": "Today", "meaning": "now", "note_date": ""})

    assert response.status_code == 201, response.text
    assert response.json()["note_date"] == date.today().isoformat()


def test_duplicate_word_or_meaning_is_rejected_case_insensitively():
    main.Base.metadata.drop_all(bind=main.engine)
    main.Base.metadata.create_all(bind=main.engine)

    first = client.post("/api/notes", json={"word": "Hello", "meaning": "bonjour"})
    assert first.status_code == 201, first.text

    duplicate_word = client.post("/api/notes", json={"word": " hello ", "meaning": "another"})
    assert duplicate_word.status_code == 409, duplicate_word.text
    assert "word" in duplicate_word.json()["detail"].lower()

    duplicate_meaning = client.post("/api/notes", json={"word": "Salut", "meaning": " bonjour "})
    assert duplicate_meaning.status_code == 409, duplicate_meaning.text
    assert "meaning" in duplicate_meaning.json()["detail"].lower()


def test_duplicate_word_is_rejected_when_equivalent_lithuanian_vowels_are_used():
    main.Base.metadata.drop_all(bind=main.engine)
    main.Base.metadata.create_all(bind=main.engine)

    first = client.post("/api/notes", json={"word": "e", "meaning": "one"})
    assert first.status_code == 201, first.text

    duplicate_word = client.post("/api/notes", json={"word": "ė", "meaning": "two"})
    assert duplicate_word.status_code == 409, duplicate_word.text
    assert "word" in duplicate_word.json()["detail"].lower()

    duplicate_word_2 = client.post("/api/notes", json={"word": "ę", "meaning": "three"})
    assert duplicate_word_2.status_code == 409, duplicate_word_2.text
    assert "word" in duplicate_word_2.json()["detail"].lower()


def test_duplicate_note_can_be_saved_when_explicitly_approved():
    main.Base.metadata.drop_all(bind=main.engine)
    main.Base.metadata.create_all(bind=main.engine)

    first = client.post("/api/notes", json={"word": "Hello", "meaning": "bonjour"})
    assert first.status_code == 201, first.text

    override = client.post(
        "/api/notes",
        json={"word": "hello", "meaning": "bonjour", "ignore_duplicate": True},
    )
    assert override.status_code == 201, override.text
    assert override.json()["word"] == "hello"


def test_bulk_import_can_be_saved_when_duplicate_rows_are_explicitly_approved():
    main.Base.metadata.drop_all(bind=main.engine)
    main.Base.metadata.create_all(bind=main.engine)

    first = client.post("/api/notes", json={"word": "tėra", "meaning": "is enough"})
    assert first.status_code == 201, first.text

    csv_payload = """tėra,already enough,context one
                  tėra,another value,context two
                  """
    response = client.post(
        "/api/notes/bulk",
        json={"csv": csv_payload, "with_header": False, "ignore_duplicate": True},
    )

    assert response.status_code == 201, response.text
    assert len(response.json()) == 2
