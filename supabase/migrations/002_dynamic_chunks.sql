-- Migration to implement dynamic chunk tables per business

-- First, let's clean up the pages table to only store page metadata
-- Drop the old unique constraint first
ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_business_id_url_chunk_index_key;

-- Drop columns
ALTER TABLE public.pages
DROP COLUMN IF EXISTS chunk_index,
DROP COLUMN IF EXISTS total_chunks,
DROP COLUMN IF EXISTS embedding,
DROP COLUMN IF EXISTS content;

-- Add a simple content column for storing raw page content (before chunking)
ALTER TABLE public.pages
ADD COLUMN IF NOT EXISTS raw_content text,
ADD COLUMN IF NOT EXISTS is_processed boolean default false;

-- Add new unique constraint for business_id + url
ALTER TABLE public.pages
ADD CONSTRAINT pages_business_id_url_unique
UNIQUE (business_id, url);

-- Function to create a chunk table for a specific business
CREATE OR REPLACE FUNCTION create_business_chunk_table(business_uuid uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    table_name text;
BEGIN
    -- Generate table name using business UUID (remove hyphens for valid table name)
    table_name := 'chunks_' || replace(business_uuid::text, '-', '');

    -- Create the chunk table if it doesn't exist
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS public.%I (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            page_id uuid NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
            content text NOT NULL,
            chunk_index integer NOT NULL,
            total_chunks integer NOT NULL,
            embedding vector(1536),
            created_at timestamptz DEFAULT now(),
            UNIQUE(page_id, chunk_index)
        )', table_name);

    -- Create index for vector search
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I ON public.%I
        USING ivfflat (embedding vector_cosine_ops)
    ', table_name || '_embedding_idx', table_name);

    -- Create index for page_id lookups
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I ON public.%I (page_id)
    ', table_name || '_page_id_idx', table_name);

    RETURN table_name;
END;
$$;

-- Function to get chunk table name for a business
CREATE OR REPLACE FUNCTION get_business_chunk_table(business_uuid uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN 'chunks_' || replace(business_uuid::text, '-', '');
END;
$$;

-- Updated match function that works with dynamic chunk tables
CREATE OR REPLACE FUNCTION match_business_chunks(
    business_uuid uuid,
    query_embedding vector(1536),
    match_count int DEFAULT 5,
    similarity_threshold float DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    page_id uuid,
    content text,
    similarity float,
    page_url text,
    page_title text
)
LANGUAGE plpgsql
AS $$
DECLARE
    table_name text;
    query_sql text;
BEGIN
    -- Get the chunk table name for this business
    table_name := get_business_chunk_table(business_uuid);

    -- Build dynamic query
    query_sql := format('
        SELECT c.id, c.page_id, c.content,
               1 - (c.embedding <=> $1) as similarity,
               p.url as page_url,
               p.title as page_title
        FROM public.%I c
        JOIN public.pages p ON c.page_id = p.id
        WHERE c.embedding IS NOT NULL
          AND p.business_id = $2
          AND (1 - (c.embedding <=> $1)) >= $3
        ORDER BY c.embedding <=> $1
        LIMIT $4
    ', table_name);

    -- Execute dynamic query
    RETURN QUERY EXECUTE query_sql USING query_embedding, business_uuid, similarity_threshold, match_count;

EXCEPTION
    WHEN undefined_table THEN
        -- Table doesn't exist yet, return empty result
        RETURN;
END;
$$;

-- Function to ensure chunk table exists for a business
CREATE OR REPLACE FUNCTION ensure_business_chunk_table(business_uuid uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    table_name text;
BEGIN
    table_name := get_business_chunk_table(business_uuid);

    -- Check if table exists, if not create it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = table_name
    ) THEN
        PERFORM create_business_chunk_table(business_uuid);
    END IF;

    RETURN table_name;
END;
$$;

-- Drop the old match_pages function since we're replacing it
DROP FUNCTION IF EXISTS public.match_pages(vector, int, float, uuid);