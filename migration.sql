-- Enable required extensions
create extension if not exists vector;
create extension if not exists pgcrypto;

-- Add new columns if missing
alter table if exists public.pages
  add column if not exists chunk_index integer default 0,
  add column if not exists total_chunks integer default 1,
  add column if not exists created_at timestamptz default now();

-- Drop old unique(url) if it exists
do \$\$
begin
  if exists (select 1 from pg_constraint where conname = 'pages_url_key') then
    alter table public.pages drop constraint pages_url_key;
  end if;
end \$\$;

-- Add the new uniqueness constraint on (url, chunk_index)
do \$\$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'pages_url_chunk_index_unique'
  ) then
    alter table public.pages
      add constraint pages_url_chunk_index_unique unique (url, chunk_index);
  end if;
end \$\$;

-- Ensure the vector index exists
create index if not exists pages_embedding_idx on public.pages using ivfflat (embedding vector_cosine_ops);

-- Reload schema cache
notify pgrst, 'reload schema';
