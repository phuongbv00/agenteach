DELETE FROM sessions;
DROP TABLE IF EXISTS messages;
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL
);
