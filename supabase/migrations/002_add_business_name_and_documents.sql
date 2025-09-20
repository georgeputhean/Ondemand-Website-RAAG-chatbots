-- Add business_name column to businesses table
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS business_name text;

-- Create documents table for file uploads
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text NOT NULL,
  file_size bigint NOT NULL,
  content text NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

-- Add index for business_id lookups
CREATE INDEX IF NOT EXISTS documents_business_id_idx ON public.documents(business_id);

-- Add embedding column to documents table for RAG search
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add index for document embeddings
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON public.documents USING ivfflat (embedding vector_cosine_ops);

-- Update the match_pages function to also search documents
DROP FUNCTION IF EXISTS public.match_content(vector, uuid, int, float);
CREATE OR REPLACE FUNCTION public.match_content(
  query_embedding vector(1536),
  in_business_id uuid,
  match_count int default 5,
  similarity_threshold float default 0
)
RETURNS TABLE (
  id uuid,
  url text,
  title text,
  content text,
  similarity float,
  source_type text
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  (
    -- Search pages
    SELECT p.id, p.url, p.title, p.content,
           1 - (p.embedding <=> query_embedding) as similarity,
           'page'::text as source_type
    FROM public.pages p
    WHERE p.embedding IS NOT NULL
      AND p.business_id = in_business_id
      AND (1 - (p.embedding <=> query_embedding)) >= similarity_threshold
  )
  UNION ALL
  (
    -- Search documents
    SELECT d.id, d.filename as url, d.filename as title, d.content,
           1 - (d.embedding <=> query_embedding) as similarity,
           'document'::text as source_type
    FROM public.documents d
    WHERE d.embedding IS NOT NULL
      AND d.business_id = in_business_id
      AND (1 - (d.embedding <=> query_embedding)) >= similarity_threshold
  )
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;