import sqlite3

conn = sqlite3.connect("data/notes_app.db")
conn.row_factory = sqlite3.Row

for table in conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall():
    print("TABLE:", table["name"])

print("\nExample: all notes")
for row in conn.execute("SELECT * FROM notes ORDER BY id LIMIT 20").fetchall():
    print(dict(row))

conn.close()