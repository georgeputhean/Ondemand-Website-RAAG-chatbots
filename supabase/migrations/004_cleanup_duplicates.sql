-- Clean up duplicate pages before adding unique constraint

-- First, let's see what we're dealing with and clean up duplicates
-- Keep only the most recent entry for each business_id + url combination

-- Step 1: Delete duplicate rows, keeping only the one with the latest created_at
DELETE FROM public.pages p1
USING public.pages p2
WHERE p1.business_id = p2.business_id
  AND p1.url = p2.url
  AND p1.created_at < p2.created_at;

-- Step 2: If there are still exact duplicates (same created_at), keep only one
DELETE FROM public.pages p1
USING public.pages p2
WHERE p1.business_id = p2.business_id
  AND p1.url = p2.url
  AND p1.id > p2.id;

-- Step 3: Now add the unique constraint
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