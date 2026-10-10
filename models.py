import os

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Date, DateTime,
    ForeignKey, Enum as SQLEnum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sub_categories = relationship(
        "SubCategory", back_populates="category", cascade="all, delete-orphan"
    )
    notes = relationship("Note", back_populates="category")


class SubCategory(Base):
    __tablename__ = "sub_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    category_id = Column(
        Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    category = relationship("Category", back_populates="sub_categories")
    notes = relationship("Note", back_populates="sub_category")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    meaning = Column(String(200), nullable=False)
    note_text = Column(Text, nullable=False)
    priority = Column(
        SQLEnum("low", "medium", "high", name="priorityenum", create_type=False),
        default="medium",
    )
    is_archived = Column(Boolean, default=False)
    tags = Column(String(500), nullable=True)
    color = Column(String(7), nullable=True)
    category_id = Column(
        Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    sub_category_id = Column(
        Integer, ForeignKey("sub_categories.id", ondelete="SET NULL"), nullable=True
    )
    note_date = Column(Date, server_default=func.current_date())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    category = relationship("Category", back_populates="notes")
    sub_category = relationship("SubCategory", back_populates="notes")

