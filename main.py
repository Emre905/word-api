import os
import shutil
import tempfile
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
    archived: Optional[bool] = Query(False),
    category_id: Optional[int] = Query(None),
    sub_category_id: Optional[int] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Note)
    if not archived:
        q = q.filter(Note.is_archived == False)
    if category_id is not None:
        q = q.filter(Note.category_id == category_id)
    if sub_category_id is not None:
        q = q.filter(Note.sub_category_id == sub_category_id)
    if priority:
        q = q.filter(Note.priority == priority)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            Note.title.ilike(pattern) | Note.note_text.ilike(pattern) | Note.tags.ilike(pattern)
        )
    return q.order_by(Note.created_at.desc()).all()


@app.post("/api/notes", response_model=NoteResponse, status_code=201)
def create_note(payload: NoteCreate, db: Session = Depends(get_db)):
    note = Note(**payload.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


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
    for field, value in payload.model_dump(exclude_unset=True).items():
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


