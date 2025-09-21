-- Quick fix for the unique constraint issue
-- Run this in your Supabase SQL editor

-- Drop the old unique constraint
ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_business_id_url_chunk_index_key;

-- Add new unique constraint for business_id + url only
ALTER TABLE public.pages
ADD CONSTRAINT pages_business_id_url_unique
UNIQUE (business_id, url);

-- Also ensure the table structure is correct for the new system
-- (You might need to drop and recreate if columns are mismatched)