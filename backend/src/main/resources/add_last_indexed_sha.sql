ALTER TABLE repositories ADD COLUMN IF NOT EXISTS last_indexed_sha VARCHAR(40);
