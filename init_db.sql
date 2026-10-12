-- Notes App - Database initialization script
-- Run: psql -U postgres -f init_db.sql

-- Create database (run separately if needed)
-- CREATE DATABASE notes_app;

-- Connect to the database
\c notes_app;

-- Enable pgcrypto for UUID generation (optional)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enum type for note priority
DO $$ BEGIN
    CREATE TYPE priorityenum AS ENUM ('low', 'medium', 'high');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sub-Categories
CREATE TABLE IF NOT EXISTS sub_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notes
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    word VARCHAR(200) NOT NULL,
    meaning VARCHAR(200) NOT NULL,
    context TEXT NOT NULL,
    priority priorityenum DEFAULT 'medium',
    is_archived BOOLEAN DEFAULT FALSE,
    tags VARCHAR(500),
    color VARCHAR(7),
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    sub_category_id INTEGER REFERENCES sub_categories(id) ON DELETE SET NULL,
    note_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for search performance
CREATE INDEX IF NOT EXISTS idx_notes_word ON notes USING gin (to_tsvector('english', word));
CREATE INDEX IF NOT EXISTS idx_notes_text ON notes USING gin (to_tsvector('english', context));
CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category_id);
CREATE INDEX IF NOT EXISTS idx_notes_sub_category ON notes(sub_category_id);
CREATE INDEX IF NOT EXISTS idx_notes_priority ON notes(priority);
CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(is_archived);
CREATE INDEX IF NOT EXISTS idx_sub_categories_category ON sub_categories(category_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notes_updated_at ON notes;
CREATE TRIGGER trg_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
