\timing on

-- Exact search 1k
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id FROM vector_store_bench WHERE metadata->>'repoId' = '11111111-1111-1111-1111-111111111111' 
ORDER BY embedding <=> (SELECT embedding FROM vector_store_bench LIMIT 1) ASC LIMIT 5;

-- Exact search 10k
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id FROM vector_store_bench WHERE metadata->>'repoId' = '22222222-2222-2222-2222-222222222222' 
ORDER BY embedding <=> (SELECT embedding FROM vector_store_bench LIMIT 1) ASC LIMIT 5;

-- Exact search 50k
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id FROM vector_store_bench WHERE metadata->>'repoId' = '33333333-3333-3333-3333-333333333333' 
ORDER BY embedding <=> (SELECT embedding FROM vector_store_bench LIMIT 1) ASC LIMIT 5;

-- Exact search 100k
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id FROM vector_store_bench WHERE metadata->>'repoId' = '44444444-4444-4444-4444-444444444444' 
ORDER BY embedding <=> (SELECT embedding FROM vector_store_bench LIMIT 1) ASC LIMIT 5;
