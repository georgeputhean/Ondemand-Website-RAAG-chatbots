-- COMPLETE SUPABASE DEPLOYMENT SCRIPT
-- Run this entire script in your Supabase SQL Editor
-- This will set up all required functions and fix schema issues

-- Step 1: Ensure pgvector is enabled
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 2: Fix unique constraints on pages table
-- Drop the old unique constraint that included chunk_index
ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_business_id_url_chunk_index_key;

-- Step 3: Clean up duplicate pages (keep only the most recent)
DELETE FROM public.pages p1
USING public.pages p2
WHERE p1.business_id = p2.business_id
  AND p1.url = p2.url
  AND p1.created_at < p2.created_at;

-- Delete remaining exact duplicates (same created_at), keep only one
DELETE FROM public.pages p1
USING public.pages p2
WHERE p1.business_id = p2.business_id
  AND p1.url = p2.url
  AND p1.id > p2.id;

-- Step 4: Add new unique constraint for business_id + url only
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_business_id_url_unique'
        AND table_name = 'pages'
    ) THEN
        ALTER TABLE public.pages
        ADD CONSTRAINT pages_business_id_url_unique
        UNIQUE (business_id, url);
    END IF;
END $$;

-- Step 5: Ensure pages table has correct structure
-- Remove old chunk-related columns if they still exist
ALTER TABLE public.pages DROP COLUMN IF EXISTS chunk_index;
ALTER TABLE public.pages DROP COLUMN IF EXISTS total_chunks;
ALTER TABLE public.pages DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.pages DROP COLUMN IF EXISTS content;

-- Add new columns
ALTER TABLE public.pages
ADD COLUMN IF NOT EXISTS raw_content text,
ADD COLUMN IF NOT EXISTS is_processed boolean DEFAULT false;

-- Ensure businesses table has required columns
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS business_name text,
ADD COLUMN IF NOT EXISTS system_prompt text;

-- Step 6: Create dynamic chunk table functions
CREATE OR REPLACE FUNCTION create_business_chunk_table(business_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    chunk_table_name text;
BEGIN
    -- Generate table name using business UUID (remove hyphens for valid table name)
    chunk_table_name := 'chunks_' || replace(business_uuid::text, '-', '');

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
        )', chunk_table_name);

    -- Create index for vector search
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I ON public.%I
        USING ivfflat (embedding vector_cosine_ops)
    ', chunk_table_name || '_embedding_idx', chunk_table_name);

    -- Create index for page_id lookups
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I ON public.%I (page_id)
    ', chunk_table_name || '_page_id_idx', chunk_table_name);

    RETURN chunk_table_name;
END;
$$;

-- Function to get chunk table name for a business
CREATE OR REPLACE FUNCTION get_business_chunk_table(business_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN 'chunks_' || replace(business_uuid::text, '-', '');
END;
$$;

-- Function to ensure chunk table exists for a business
CREATE OR REPLACE FUNCTION ensure_business_chunk_table(business_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    chunk_table_name text;
BEGIN
    chunk_table_name := get_business_chunk_table(business_uuid);

    -- Check if table exists, if not create it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = chunk_table_name
    ) THEN
        PERFORM create_business_chunk_table(business_uuid);
    END IF;

    RETURN chunk_table_name;
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
SECURITY DEFINER
AS $$
DECLARE
    chunk_table_name text;
    query_sql text;
BEGIN
    -- Get the chunk table name for this business
    chunk_table_name := get_business_chunk_table(business_uuid);

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
    ', chunk_table_name);

    -- Execute dynamic query
    RETURN QUERY EXECUTE query_sql USING query_embedding, business_uuid, similarity_threshold, match_count;

EXCEPTION
    WHEN undefined_table THEN
        -- Table doesn't exist yet, return empty result
        RETURN;
END;
$$;

-- Function to check if functions are properly deployed
CREATE OR REPLACE FUNCTION check_chunk_functions_available()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Try to call ensure_business_chunk_table with a dummy UUID
    -- If it works, functions are available
    PERFORM ensure_business_chunk_table('00000000-0000-0000-0000-000000000000'::uuid);
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$;

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS public.match_pages(vector, int, float, uuid);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_business_chunk_table(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_business_chunk_table(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_business_chunk_table(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION match_business_chunks(uuid, vector, int, float) TO authenticated;
GRANT EXECUTE ON FUNCTION check_chunk_functions_available() TO authenticated;

-- Test the functions by creating a test business chunk table
DO $$
DECLARE
    test_uuid uuid := '12345678-1234-1234-1234-123456789012';
    result_table_name text;
BEGIN
    result_table_name := ensure_business_chunk_table(test_uuid);
    RAISE NOTICE 'Test successful: Created table %', result_table_name;

    -- Clean up test table
    EXECUTE format('DROP TABLE IF EXISTS public.%I', result_table_name);
END $$;