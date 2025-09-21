-- Fix unique constraints after removing chunk-related columns

-- Drop the old unique constraint that included chunk_index
ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_business_id_url_chunk_index_key;

-- Add new unique constraint for business_id + url only
-- Use DO block to add constraint only if it doesn't exist
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

-- Ensure the pages table has the correct structure for the new system
-- Remove any remaining chunk-related columns if they still exist
ALTER TABLE public.pages DROP COLUMN IF EXISTS chunk_index;
ALTER TABLE public.pages DROP COLUMN IF EXISTS total_chunks;
ALTER TABLE public.pages DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.pages DROP COLUMN IF EXISTS content;

-- Ensure new columns exist
ALTER TABLE public.pages
ADD COLUMN IF NOT EXISTS raw_content text,
ADD COLUMN IF NOT EXISTS is_processed boolean DEFAULT false;

-- Also ensure businesses table has the new columns we might need
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS business_name text,
ADD COLUMN IF NOT EXISTS system_prompt text;