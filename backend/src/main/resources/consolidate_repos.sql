-- 1. Create the new user_repos join table
CREATE TABLE user_repos (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    repo_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_user_repo UNIQUE (user_id, repo_id)
);

-- 2. Populate the join table from the existing repositories table
INSERT INTO user_repos (id, user_id, repo_id, created_at)
SELECT gen_random_uuid(), user_id, id, created_at
FROM repositories;

-- 3. Consolidate duplicates in repositories table
-- We will keep the repository row that was created first (min id or min created_at)
-- and update user_repos to point to the consolidated repo_id.

-- Create a temporary mapping of old repo_id to the consolidated repo_id
CREATE TEMP TABLE repo_mapping AS
SELECT 
    id AS old_repo_id,
    FIRST_VALUE(id) OVER (PARTITION BY github_repo_id ORDER BY created_at ASC) AS new_repo_id
FROM repositories;

-- Update the join table to point to the consolidated repo_id
UPDATE user_repos ur
SET repo_id = rm.new_repo_id
FROM repo_mapping rm
WHERE ur.repo_id = rm.old_repo_id;

-- 4. Re-key vector_store metadata
-- If you have existing vectors, their metadata contains the old repoId.
-- We must update the JSON metadata in vector_store to the new consolidated repoId.
UPDATE vector_store vs
SET metadata = jsonb_set(metadata, '{repoId}', to_jsonb(rm.new_repo_id::text))
FROM repo_mapping rm
WHERE metadata->>'repoId' = rm.old_repo_id::text;

-- 5. Delete duplicate repository rows
DELETE FROM repositories
WHERE id IN (
    SELECT old_repo_id 
    FROM repo_mapping 
    WHERE old_repo_id != new_repo_id
);

-- 6. Modify schema constraints
ALTER TABLE repositories DROP COLUMN user_id;
-- Drop the old constraint
ALTER TABLE repositories DROP CONSTRAINT IF EXISTS uk_repositories_user_github;
-- Add the new global constraint
ALTER TABLE repositories ADD CONSTRAINT uk_repositories_github_repo_id UNIQUE (github_repo_id);
