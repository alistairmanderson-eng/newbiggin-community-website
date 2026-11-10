ALTER TABLE toolshare_catalogue
  ADD COLUMN IF NOT EXISTS weekly_rate NUMERIC(10,2)
    CHECK (weekly_rate IS NULL OR weekly_rate >= 0),
  ADD COLUMN IF NOT EXISTS suitable_uses TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS additional_items TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo_filename TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS import_batch_id UUID;

ALTER TABLE toolshare_bookings
  ADD COLUMN IF NOT EXISTS weekly_rate NUMERIC(10,2)
    CHECK (weekly_rate IS NULL OR weekly_rate >= 0);

CREATE TABLE IF NOT EXISTS toolshare_catalogue_imports (
  id UUID PRIMARY KEY,
  filename TEXT NOT NULL,
  tool_type TEXT NOT NULL CHECK (tool_type IN ('Hall', 'Community')),
  imported_by TEXT NOT NULL,
  imported_count INTEGER NOT NULL CHECK (imported_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'toolshare_catalogue_import_batch_fk') THEN
    ALTER TABLE toolshare_catalogue ADD CONSTRAINT toolshare_catalogue_import_batch_fk
      FOREIGN KEY (import_batch_id) REFERENCES toolshare_catalogue_imports(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS toolshare_catalogue_import_batch_idx
  ON toolshare_catalogue(import_batch_id) WHERE import_batch_id IS NOT NULL;
