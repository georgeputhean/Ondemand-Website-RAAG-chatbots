# RAAG Chatbots

Create an AI chatbot trained on your website content.

## Tech Stack
- Next.js 14 (App Router) + TailwindCSS
- Supabase (Postgres + pgvector)
- OpenAI API (embeddings + chat)
- Firecrawl API (website crawler)

## Getting Started

1. Clone and install:
```bash
pnpm install # or npm install / yarn
```

2. Configure environment:
Create `.env.local` with:
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
FIRECRAWL_API_KEY=...
```

3. Set up Supabase schema:
- Ensure pgvector is enabled. Run migration SQL in `supabase/migrations/001_init.sql` on your Supabase project (SQL Editor).

4. Develop:
```bash
pnpm dev
```
Open `http://localhost:3000`.

## How it works
- Enter a website URL on the home page.
- The app calls Firecrawl to get public pages and extracts clean text.
- Page contents are embedded with OpenAI and stored in Supabase `pages` with a `vector` column.
- Chat queries generate an embedding, retrieve the most similar pages, and the LLM answers with citations.

## API
- `POST /api/crawl` body `{ url }` → crawls, embeds, and upserts pages.
- `POST /api/chat` body `{ messages }` → RAG answer `{ answer, sources }`.

## Embeddable widget (simple iframe)
Place this snippet on any page of your site:
```html
<iframe
  src="YOUR_APP_URL/chat"
  style="width: 100%; max-width: 420px; height: 600px; border: 1px solid #e5e7eb; border-radius: 12px;"
></iframe>
```

For custom JS widgets, you can serve assets under `/widget` and render a floating chat button that loads the iframe.

## Notes
- Change OpenAI models in `lib/openai.ts` if desired.
- Adjust crawl limits and text filtering in `lib/firecrawl.ts`.
- Add auth/tenancy by adding a `businesses` table and a foreign key on `pages`.

## License
MIT


