-- Enable pgvector
create extension if not exists vector;
create extension if not exists pgcrypto;

-- Businesses (tenants)
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  domain text not null unique,
  system_prompt text,
  created_at timestamptz default now()
);

-- Pages table
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  url text not null,
  title text not null,
  content text not null,
  content_hash text,
  chunk_index integer default 0,
  total_chunks integer default 1,
  embedding vector(1536),
  created_at timestamp with time zone default now(),
  unique(business_id, url, chunk_index)
);

-- For similarity search
drop function if exists public.match_pages(vector, int, float);
create or replace function public.match_pages(
  query_embedding vector(1536),
  match_count int default 5,
  similarity_threshold float default 0,
  in_business_id uuid
)
returns table (
  id uuid,
  url text,
  title text,
  content text,
  similarity float
) language plpgsql as $$
begin
  return query
  select p.id, p.url, p.title, p.content,
         1 - (p.embedding <=> query_embedding) as similarity
  from public.pages p
  where p.embedding is not null
    and p.business_id = in_business_id
    and (1 - (p.embedding <=> query_embedding)) >= similarity_threshold
  order by p.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Index for vector search
create index if not exists pages_embedding_idx on public.pages using ivfflat (embedding vector_cosine_ops);


