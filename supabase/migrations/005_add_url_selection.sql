-- Add URL selection and discovery columns to pages table

-- Add is_selected column for user URL selection
ALTER TABLE public.pages
ADD COLUMN IF NOT EXISTS is_selected boolean DEFAULT false;

-- Add discovered_at column to track when URL was discovered
ALTER TABLE public.pages
ADD COLUMN IF NOT EXISTS discovered_at timestamptz DEFAULT now();

-- Create index for faster queries on selected pages
CREATE INDEX IF NOT EXISTS pages_business_selected_idx
ON public.pages (business_id, is_selected)
WHERE is_selected = true;

-- Create index for discovery queries
CREATE INDEX IF NOT EXISTS pages_business_discovered_idx
ON public.pages (business_id, discovered_at);

-- Update existing pages to be selected by default (backward compatibility)
UPDATE public.pages
SET is_selected = true, discovered_at = created_at
WHERE is_selected IS NULL OR discovered_at IS NULL;