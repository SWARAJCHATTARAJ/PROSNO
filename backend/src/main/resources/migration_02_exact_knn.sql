-- Migration: Switch from HNSW to Exact KNN for isolated repository search
-- Reason: For the current repository-isolated workload, exact KNN
-- with repository pre-filtering is the preferred approach.
-- Measured HNSW behavior was unsuitable for this query pattern.
-- IVFFlat was not benchmarked and should be re-evaluated if the workload changes.
-- Performance scales with repository size (e.g., ~379ms for 100k vectors in synthetic benchmarks).
-- 1. Drop the inefficient global HNSW index created by older Spring AI configurations
DROP INDEX IF EXISTS spring_ai_vector_index;

-- 2. Create a standard B-Tree index on the repository ID
-- This allows PostgreSQL to instantly isolate the subset of vectors for the given repository
-- before performing exact SIMD vectorized distance computation.
-- In production, run this CONCURRENTLY to avoid locking the table.
-- NOTE: CREATE INDEX CONCURRENTLY must NOT be executed inside a transaction block.
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vector_store_repo_id ON vector_store ((metadata->>'repoId'));
CREATE INDEX IF NOT EXISTS idx_vector_store_repo_id ON vector_store ((metadata->>'repoId'));
