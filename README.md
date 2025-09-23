# Trovix.ai

Create an AI chatbot trained on your website content.

## Tech Stack
- Next.js 14 (App Router) + TailwindCSS
- Supabase (Postgres + pgvector)
- OpenAI API (embeddings + chat)
- GroqCrawl (custom website crawler using Puppeteer)

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
```

3. Set up Supabase schema:
- Ensure pgvector is enabled. Run migration SQL in `supabase/migrations/001_init.sql` on your Supabase project (SQL Editor).

4. Develop:
```bash
pnpm dev
```
Open `http://localhost:3000`.

## How it works
- Register your business and enter a website URL.
- The app uses GroqCrawl (custom Puppeteer-based crawler) to discover and scrape website pages.
- Users can select specific pages to crawl from the discovered URLs.
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
- Adjust crawl limits and text filtering in `lib/groqcrawl.ts`.
- Business registration and tenancy is implemented with `businesses` table and foreign keys on `pages`.

## License
MIT


