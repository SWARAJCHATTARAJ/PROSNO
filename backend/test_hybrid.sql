-- Test Hybrid Merge
WITH vector_matches AS (
    SELECT id, content, metadata, embedding <=> (SELECT embedding FROM vector_store_bench LIMIT 1) AS distance
    FROM vector_store_bench
    WHERE metadata->>'repoId' = '11111111-1111-1111-1111-111111111111'
    ORDER BY distance ASC
    LIMIT 2
),
text_matches AS (
    SELECT id, content, metadata, ts_rank(to_tsvector('english', content), plainto_tsquery('english', 'test')) AS rank
    FROM vector_store_bench
    WHERE metadata->>'repoId' = '11111111-1111-1111-1111-111111111111'
      AND to_tsvector('english', content) @@ plainto_tsquery('english', 'test')
    ORDER BY rank DESC
    LIMIT 2
)
SELECT id, content FROM vector_matches
UNION ALL
SELECT id, content FROM text_matches
LIMIT 4;
