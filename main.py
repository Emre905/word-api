import csv
import io
import os
import re
import shutil
import tempfile
import unicodedata
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from database import DATA_DIR, DATABASE_URL, Base, engine, get_db
from models import Category, Note, SubCategory
from schemas import (
    BulkNotesCreate,
    CategoryCreate,
    CategoryResponse,
    NoteCreate,
    NoteResponse,
    NoteUpdate,
    SubCategoryCreate,
    SubCategoryResponse,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Notes App")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# ── Pages ────────────────────────────────────────────────────────────────────


@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.get("/favicon.ico")
async def favicon():
    return FileResponse("static/favicon.ico")


# ── Backup ────────────────────────────────────────────────────────────────────


DB_FILE = os.path.join(DATA_DIR, "notes_app.db")


@app.get("/api/backup")
def backup():
    today = date.today().isoformat()
    if not os.path.exists(DB_FILE):
        raise HTTPException(404, "Database file not found")
    return FileResponse(
        path=DB_FILE,
        media_type="application/octet-stream",
        filename=f"notes_backup_{today}.db",
    )


@app.post("/api/restore")
def restore(file: UploadFile = File(...)):
    if not file.filename.endswith(".db"):
        raise HTTPException(400, "Only .db files accepted")
    try:
        content = file.file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        engine.dispose()
        shutil.copy2(tmp_path, DB_FILE)
        Base.metadata.create_all(bind=engine)
        return {"message": "Restore successful"}
    except Exception as e:
        raise HTTPException(500, f"Restore failed: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


# ── Category CRUD ────────────────────────────────────────────────────────────


@app.get("/api/categories", response_model=List[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.name).all()


@app.post("/api/categories", response_model=CategoryResponse, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.name == payload.name).first()
    if existing:
        raise HTTPException(409, "Category already exists")
    cat = Category(**payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@app.delete("/api/categories/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    db.delete(cat)
    db.commit()


# ── SubCategory CRUD ─────────────────────────────────────────────────────────


@app.get("/api/sub_categories", response_model=List[SubCategoryResponse])
def list_sub_categories(
    category_id: Optional[int] = Query(None), db: Session = Depends(get_db)
):
    q = db.query(SubCategory)
    if category_id is not None:
        q = q.filter(SubCategory.category_id == category_id)
    return q.order_by(SubCategory.name).all()


@app.post("/api/sub_categories", response_model=SubCategoryResponse, status_code=201)
def create_sub_category(payload: SubCategoryCreate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == payload.category_id).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    sub = SubCategory(**payload.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@app.delete("/api/sub_categories/{sub_category_id}", status_code=204)
def delete_sub_category(sub_category_id: int, db: Session = Depends(get_db)):
    sub = db.query(SubCategory).filter(SubCategory.id == sub_category_id).first()
    if not sub:
        raise HTTPException(404, "SubCategory not found")
    db.delete(sub)
    db.commit()


# ── Note CRUD ────────────────────────────────────────────────────────────────


@app.get("/api/notes", response_model=List[NoteResponse])
def list_notes(
    category_id: Optional[int] = Query(None),
    sub_category_id: Optional[int] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Note)
    if category_id is not None:
        q = q.filter(Note.category_id == category_id)
    if sub_category_id is not None:
        q = q.filter(Note.sub_category_id == sub_category_id)
    if priority:
        q = q.filter(Note.priority == priority)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            Note.word.ilike(pattern)
            | Note.meaning.ilike(pattern)
            | Note.context.ilike(pattern)
            | Note.tags.ilike(pattern)
        )
    return q.order_by(Note.created_at.desc()).all()


def _normalize_duplicate_value(value: Optional[str]) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKD", text.casefold())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _normalize_tags_value(value: Optional[str]) -> Optional[str]:
    raw = (value or "").strip()
    if not raw:
        return None

    normalized_parts = [part.strip() for part in re.split(r"[\s,]+", raw) if part.strip()]
    if not normalized_parts:
        return None
    return ", ".join(normalized_parts)


def _find_duplicate_note(db: Session, *, field_name: str, value: Optional[str], note_id: Optional[int] = None):
    key = _normalize_duplicate_value(value)
    if not key:
        return None

    for existing_note in db.query(Note).filter(Note.id != note_id).all():
        existing_value = getattr(existing_note, field_name)
        if _normalize_duplicate_value(existing_value) == key:
            return existing_note
    return None


def _ensure_unique_note_values(
    db: Session,
    *,
    word: Optional[str] = None,
    meaning: Optional[str] = None,
    note_id: Optional[int] = None,
):
    word_key = _normalize_duplicate_value(word)
    meaning_key = _normalize_duplicate_value(meaning)

    if word_key:
        duplicate = _find_duplicate_note(db, field_name="word", value=word, note_id=note_id)
        if duplicate:
            raise HTTPException(409, f"Duplicate word: '{duplicate.word}' already exists.")

    if meaning_key:
        duplicate = _find_duplicate_note(db, field_name="meaning", value=meaning, note_id=note_id)
        if duplicate:
            raise HTTPException(409, f"Duplicate meaning: '{duplicate.meaning}' already exists.")


@app.post("/api/notes", response_model=NoteResponse, status_code=201)
def create_note(payload: NoteCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    ignore_duplicate = bool(data.pop("ignore_duplicate", False))
    data["word"] = (data.get("word") or "").strip()
    data["meaning"] = (data.get("meaning") or "").strip()
    data["context"] = (data.get("context") or "").strip()
    data["tags"] = _normalize_tags_value(data.get("tags"))
    data["note_date"] = data.get("note_date") or date.today()

    if not ignore_duplicate:
        _ensure_unique_note_values(db, word=data["word"], meaning=data["meaning"])

    note = Note(**data)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def _parse_csv_note_date(raw_value: str) -> date:
    value = (raw_value or "").strip()
    if not value:
        return date.today()

    for fmt in (
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%B %d, %Y %I:%M %p",
        "%b %d, %Y %I:%M %p",
        "%Y/%m/%d",
    ):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue

    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        pass

    return date.today()


def _normalize_bulk_row(row: dict) -> dict:
    normalized = {}
    for key, value in (row or {}).items():
        if key is None:
            continue
        normalized[key.strip().lstrip("\ufeff").lower()] = (value or "").strip()

    word = (
        normalized.get("word")
        or normalized.get("word ")
        or ""
    )
    meaning = normalized.get("meaning") or normalized.get("translation") or ""
    context = (
        normalized.get("context")
        or normalized.get("example")
        or ""
    )
    tags = _normalize_tags_value(normalized.get("category") or normalized.get("tags") or "") or ""
    created_time = (
        normalized.get("created time")
        or normalized.get("created_time")
        or normalized.get("date")
        or ""
    )

    return {
        "word": word,
        "meaning": meaning,
        "context": context,
        "tags": tags,
        "note_date": _parse_csv_note_date(created_time),
    }


def _parse_bulk_csv(csv_text: str, with_header: bool) -> List[dict]:
    rows: List[dict] = []
    reader = csv.reader(io.StringIO(csv_text))
    csv_rows = list(reader)

    if not csv_rows:
        raise HTTPException(400, "CSV content is required")

    if with_header:
        header = csv_rows[0]
        if not any(cell.strip() for cell in header):
            raise HTTPException(400, "CSV file is missing a header row")
        data_rows = csv_rows[1:]
        fieldnames = [cell.strip().lower() for cell in header]
        for row in data_rows:
            if not row or not any((cell or "").strip() for cell in row):
                continue
            row_dict = {fieldnames[i]: row[i] if i < len(row) else "" for i in range(len(fieldnames))}
            rows.append(_normalize_bulk_row(row_dict))
        return rows

    for row_number, row in enumerate(csv_rows, start=1):
        if not row or not any((cell or "").strip() for cell in row):
            continue
        if len(row) < 5:
            padded = row + [""] * (5 - len(row))
        else:
            padded = row[:5]
        row_dict = {
            "word": padded[0],
            "meaning": padded[1],
            "context": padded[2],
            "category": padded[3],
            "created time": padded[4],
        }
        rows.append(_normalize_bulk_row(row_dict))
    return rows


@app.post("/api/notes/bulk", response_model=List[NoteResponse], status_code=201)
def create_notes_bulk(payload: BulkNotesCreate, db: Session = Depends(get_db)):
    csv_text = (payload.csv or "").strip()
    if not csv_text:
        raise HTTPException(400, "CSV content is required")

    parsed_rows = _parse_bulk_csv(csv_text, payload.with_header)
    if not parsed_rows:
        raise HTTPException(400, "No valid notes were found in the CSV payload")

    created_notes = []
    seen_words = set()
    seen_meanings = set()
    ignore_duplicate = bool(payload.ignore_duplicate)

    for row_number, parsed in enumerate(parsed_rows, start=1):
        word = (parsed.get("word") or "").strip()
        meaning = (parsed.get("meaning") or "").strip()
        context = (parsed.get("context") or "").strip()

        if not word or not meaning:
            raise HTTPException(
                400,
                f"Row {row_number} is missing a required value for word or meaning.",
            )

        word_key = _normalize_duplicate_value(word)
        meaning_key = _normalize_duplicate_value(meaning)
        if not ignore_duplicate:
            if word_key in seen_words:
                raise HTTPException(409, f"Row {row_number}: duplicate word '{word}' in the CSV upload.")
            if meaning_key in seen_meanings:
                raise HTTPException(409, f"Row {row_number}: duplicate meaning '{meaning}' in the CSV upload.")

            _ensure_unique_note_values(db, word=word, meaning=meaning)

        seen_words.add(word_key)
        seen_meanings.add(meaning_key)

        note = Note(
            word=word,
            meaning=meaning,
            context=context,
            tags=(parsed.get("tags") or "").strip() or None,
            note_date=parsed.get("note_date") or date.today(),
            priority="medium",
            color="#4f46e5",
        )
        db.add(note)
        created_notes.append(note)

    db.commit()
    for note in created_notes:
        db.refresh(note)
    return created_notes


@app.get("/api/notes/{note_id}", response_model=NoteResponse)
def get_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    return note


@app.put("/api/notes/{note_id}", response_model=NoteResponse)
def update_note(note_id: int, payload: NoteUpdate, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(404, "Note not found")

    update_data = payload.model_dump(exclude_unset=True)
    ignore_duplicate = bool(update_data.pop("ignore_duplicate", False))
    if "word" in update_data:
        update_data["word"] = (update_data["word"] or "").strip()
    if "meaning" in update_data:
        update_data["meaning"] = (update_data["meaning"] or "").strip()
    if "context" in update_data:
        update_data["context"] = (update_data["context"] or "").strip()
    if "tags" in update_data:
        update_data["tags"] = _normalize_tags_value(update_data.get("tags"))

    if not ignore_duplicate:
        _ensure_unique_note_values(
            db,
            word=update_data.get("word", note.word),
            meaning=update_data.get("meaning", note.meaning),
            note_id=note.id,
        )

    for field, value in update_data.items():
        setattr(note, field, value)
    db.commit()
    db.refresh(note)
    return note


@app.delete("/api/notes/{note_id}", status_code=204)
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    db.delete(note)
    db.commit()


