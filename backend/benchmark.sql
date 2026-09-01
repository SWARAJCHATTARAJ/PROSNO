-- Create benchmark table
CREATE TABLE vector_store_bench (
    id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
    content text,
    metadata jsonb,
    embedding vector(384)
);

-- Note: We will insert via a faster method using generate_series and cross joins to avoid long loops in PL/pgSQL.

INSERT INTO vector_store_bench (metadata, embedding)
SELECT 
    jsonb_build_object('repoId', '11111111-1111-1111-1111-111111111111'), 
    array(SELECT random() FROM generate_series(1, 384))::vector
FROM generate_series(1, 1000);

INSERT INTO vector_store_bench (metadata, embedding)
SELECT 
    jsonb_build_object('repoId', '22222222-2222-2222-2222-222222222222'), 
    array(SELECT random() FROM generate_series(1, 384))::vector
FROM generate_series(1, 10000);

INSERT INTO vector_store_bench (metadata, embedding)
SELECT 
    jsonb_build_object('repoId', '33333333-3333-3333-3333-333333333333'), 
    array(SELECT random() FROM generate_series(1, 384))::vector
FROM generate_series(1, 50000);

INSERT INTO vector_store_bench (metadata, embedding)
SELECT 
    jsonb_build_object('repoId', '44444444-4444-4444-4444-444444444444'), 
    array(SELECT random() FROM generate_series(1, 384))::vector
FROM generate_series(1, 100000);
