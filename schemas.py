from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class PriorityEnum(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# ── Category ─────────────────────────────────────────────────────────────────


class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── SubCategory ──────────────────────────────────────────────────────────────


class SubCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    category_id: int


class SubCategoryCreate(SubCategoryBase):
    pass


class SubCategoryResponse(SubCategoryBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Note ─────────────────────────────────────────────────────────────────────


class NoteBase(BaseModel):
    title: str
    note_text: str
    priority: PriorityEnum = PriorityEnum.MEDIUM
    is_archived: bool = False
    tags: Optional[str] = None
    color: Optional[str] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    note_date: date = date.today()

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v and not v.startswith("#"):
            raise ValueError("color must be a hex value starting with #")
        return v


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    note_text: Optional[str] = None
    priority: Optional[PriorityEnum] = None
    is_archived: Optional[bool] = None
    tags: Optional[str] = None
    color: Optional[str] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    note_date: Optional[date] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v and not v.startswith("#"):
            raise ValueError("color must be a hex value starting with #")
        return v


class NoteResponse(NoteBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
