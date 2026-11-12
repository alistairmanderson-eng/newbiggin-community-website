ALTER TABLE toolshare_catalogue
  ADD COLUMN IF NOT EXISTS photo_key TEXT NOT NULL DEFAULT '';
