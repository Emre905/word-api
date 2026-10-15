# Notes Application

A sleek, modern notes-taking application built with **FastAPI** (backend) and vanilla **HTML/CSS/JavaScript** (frontend), backed by **SQLite**.

## Features

- **Categories & Sub-Categories** — Organize notes hierarchically
- **Rich Note Fields** — Word, text, priority (Low/Medium/High), tags, and color labels
- **Auto Date** — Current date is pre-filled when creating a note
- **Full CRUD** — Create, read, update, and delete notes
- **Search & Filter** — Filter by category, sub-category, priority, or full-text search on word + body + tags
- **Dark / Light Theme** — Toggle with Sun/Moon icon, persisted in localStorage
- **Database Backup** — Download the SQLite database file from the sidebar
- **Database Restore** — Upload a previous `.db` backup file to restore data
- **Responsive** — Works on desktop and mobile
- **Structured Data** — Uses SQL Database to store data. SQLite is used in the current implementation.

## Tech Stack

| Layer    | Technology                                  |
| -------- | ------------------------------------------- |
| Backend  | Python 3.11+, FastAPI, SQLAlchemy           |
| Frontend | HTML5, CSS3 (custom properties), Vanilla JS |
| Database | SQLite                                      |

## Additional Note Fields

| Field         | Type    | Description                                |
| ------------- | ------- | ------------------------------------------ |
| `word`       | string  | Descriptive word for quick identification |
| `meaning`     | string  | Meaning of word                            |
| `priority`    | enum    | `low`, `medium`, `high`                    |
| `tags`        | string  | Comma-separated tags for organization      |
| `color`       | string  | Hex color for visual categorization        |

## Getting Started

### 1. Prerequisites

- Python 3.11+

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. (Optional) Configure the connection

The database defaults to `sqlite:///data/notes_app.db`. Override with the `DATABASE_URL` environment variable:

```bash
export DATABASE_URL="sqlite:///path/to/custom.db"
```

### 4. Run the application

```bash
uvicorn main:app --reload
```

### 4.a Run app with docker:
```bash
docker run --name notes-app -p 8000:8000 my-app:final
docker cp notes-app:/app/logs/client_access.log ./client_access.log # example to copy logs to current directory
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

### 5. API documentation

FastAPI auto-generates interactive docs at [http://localhost:8000/docs](http://localhost:8000/docs).

## Backup & Restore

Both features are accessible from the **Backup** section in the sidebar. Click the section header to expand it and reveal the options.

### Download Backup

Click **Download** to download the SQLite database file (`notes_backup_YYYY-MM-DD.db`). This is a complete snapshot of all your notes, categories, and metadata.

### Restore Backup

Click **Restore** and select a previous `.db` backup file to replace the current database. The app will automatically re-create the tables on the next startup.

> **Warning:** Restoring overwrites existing data. There is no undo.

## Project Structure

```
notes_app/
├── main.py              # FastAPI application & routes
├── database.py          # SQLAlchemy engine & session
├── models.py            # ORM models (Category, SubCategory, Note)
├── schemas.py           # Pydantic request/response schemas
├── requirements.txt
├── README.md
├── data/                # SQLite database file (auto-created)
├── templates/
│   └── index.html       # Single-page application UI
└── static/
    ├── style.css        # Theme-aware styles
    ├── script.js        # Frontend logic
    └── favicon.ico
```

## Database Schema

### categories
| Column      | Type         |
| ----------- | ------------ |
| id          | PK           |
| name        | varchar(100) |
| description | text         |
| created_at  | timestamp    |

### sub_categories
| Column      | Type            |
| ----------- | --------------- |
| id          | PK              |
| name        | varchar(100)    |
| description | text            |
| category_id | FK → categories |
| created_at  | timestamp       |

### notes
| Column          | Type                |
| --------------- | ------------------- |
| id              | PK                  |
| word            | varchar(200)        |
| context         | text                |
| priority        | enum                |
| tags            | varchar(500)        |
| color           | varchar(7)          |
| category_id     | FK → categories     |
| sub_category_id | FK → sub_categories |
| note_date       | date                |
| created_at      | timestamp           |
| updated_at      | timestamp           |

## API Endpoints

| Method | Path                  | Description               |
| ------ | --------------------- | ------------------------- |
| GET    | `/api/notes`          | List notes (with filters) |
| POST   | `/api/notes`          | Create a note             |
| GET    | `/api/notes/{id}`     | Get a single note         |
| PUT    | `/api/notes/{id}`     | Update a note             |
| DELETE | `/api/notes/{id}`     | Delete a note             |

## License

MIT
