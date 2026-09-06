CREATE TABLE applications (
  id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL CHECK (typeof(revision) = 'integer' AND revision >= 0),
  next_number INTEGER NOT NULL CHECK (typeof(next_number) = 'integer' AND next_number > 0),
  draft_json TEXT NOT NULL CHECK (json_valid(draft_json) AND json_type(draft_json) = 'object'),
  published_json TEXT CHECK (published_json IS NULL OR (json_valid(published_json) AND json_type(published_json) = 'object')),
  write_token TEXT NOT NULL
);

CREATE TABLE records (
  app_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  number INTEGER NOT NULL CHECK (typeof(number) = 'integer' AND number > 0),
  values_json TEXT NOT NULL CHECK (json_valid(values_json) AND json_type(values_json) = 'object'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (app_id, id),
  UNIQUE (app_id, number)
);
