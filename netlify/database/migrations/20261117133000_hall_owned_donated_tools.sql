-- Accepted donations and all catalogue imports are property of Elizabethan Hall.
UPDATE toolshare_catalogue SET tool_type = 'Hall' WHERE tool_type <> 'Hall';
UPDATE toolshare_catalogue_imports SET tool_type = 'Hall' WHERE tool_type <> 'Hall';

ALTER TABLE toolshare_catalogue
  ALTER COLUMN tool_type SET DEFAULT 'Hall',
  DROP CONSTRAINT IF EXISTS toolshare_catalogue_tool_type_check;

ALTER TABLE toolshare_catalogue
  ADD CONSTRAINT toolshare_catalogue_tool_type_check CHECK (tool_type = 'Hall');

ALTER TABLE toolshare_catalogue_imports
  DROP CONSTRAINT IF EXISTS toolshare_catalogue_imports_tool_type_check;

ALTER TABLE toolshare_catalogue_imports
  ADD CONSTRAINT toolshare_catalogue_imports_tool_type_check CHECK (tool_type = 'Hall');
