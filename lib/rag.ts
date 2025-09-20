import { supabaseAdmin } from './supabase'
import crypto from 'crypto'

export type PageRow = {
  id: string
  url: string
  title: string
  content: string
  embedding: number[] | null
}

// Chunk content into smaller pieces for better RAG
function chunkContent(content: string, maxChunkSize = 1000, overlap = 200): string[] {
  const words = content.split(/\s+/)
  const chunks: string[] = []
  
  for (let i = 0; i < words.length; i += maxChunkSize - overlap) {
    const chunk = words.slice(i, i + maxChunkSize).join(' ')
    if (chunk.trim()) {
      chunks.push(chunk.trim())
    }
  }
  
  return chunks
}

export async function upsertPages(pages: { businessId: string; url: string; title: string; content: string; embedding?: number[] | null }[]) {
  // Gather URLs per business to read existing chunk hashes
  const businessId = pages[0]?.businessId
  const urls = Array.from(new Set(pages.map(p => p.url)))
  const existingMap = new Map<string, { id: string; content_hash: string | null }>()

  if (businessId && urls.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from('pages')
      .select('id, url, chunk_index, content_hash')
      .eq('business_id', businessId)
      .in('url', urls)

    if (existing) {
      for (const row of existing as any[]) {
        existingMap.set(`${row.url}::${row.chunk_index}`, { id: row.id, content_hash: row.content_hash })
      }
    }
  }

  const rowsToUpsert: any[] = []

  for (const page of pages) {
    const contentChunks = chunkContent(page.content)
    const contentHash = crypto.createHash('sha256').update(page.content).digest('hex')

    for (let i = 0; i < contentChunks.length; i++) {
      const key = `${page.url}::${i}`
      const existing = existingMap.get(key)
      // Skip if hash matches (no change)
      if (existing && existing.content_hash === contentHash) continue

      rowsToUpsert.push({
        business_id: page.businessId,
        url: page.url,
        title: page.title,
        content: contentChunks[i],
        chunk_index: i,
        total_chunks: contentChunks.length,
        content_hash: contentHash,
        // Force re-embedding on changed or new chunks
        embedding: null
      })
    }
  }

  if (rowsToUpsert.length > 0) {
    const { error } = await supabaseAdmin
      .from('pages')
      .upsert(rowsToUpsert, { onConflict: 'business_id,url,chunk_index', ignoreDuplicates: false })
    if (error) throw error
  }
}

export async function querySimilar(queryEmbedding: number[], topK = 5, businessId?: string) {
  // If no businessId provided, return empty results
  if (!businessId) return []

  // Try with lower similarity threshold first using the new combined search
  let { data, error } = await supabaseAdmin.rpc('match_content', {
    query_embedding: queryEmbedding,
    in_business_id: businessId,
    match_count: topK,
    similarity_threshold: 0.1,
  })

  // If no results, try with even lower threshold
  if (!data || data.length === 0) {
    const { data: fallbackData, error: fallbackError } = await supabaseAdmin.rpc('match_content', {
      query_embedding: queryEmbedding,
      in_business_id: businessId,
      match_count: topK,
      similarity_threshold: 0,
    })

    if (fallbackError) throw fallbackError
    data = fallbackData
  }

  if (error) throw error
  return data as { id: string; url: string; title: string; content: string; similarity: number; source_type: string }[]
}

// Process document content based on file type
export function extractTextFromFile(content: string, contentType: string): string {
  // For now, handle basic text files
  // In a production app, you'd want to use libraries like pdf-parse, mammoth, etc.
  if (contentType.includes('text/plain')) {
    return content
  }

  // For other types, return the content as-is for now
  // TODO: Add proper document parsing for PDF, DOC, DOCX
  return content
}

// Store document with chunking and embedding support
export async function upsertDocument(
  businessId: string,
  filename: string,
  contentType: string,
  fileSize: number,
  content: string
) {
  const processedContent = extractTextFromFile(content, contentType)

  // Store document in database
  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .upsert({
      business_id: businessId,
      filename,
      content_type: contentType,
      file_size: fileSize,
      content: processedContent,
      embedding: null // Will be generated later
    }, { onConflict: 'business_id,filename' })
    .select('id')
    .single()

  if (error) throw error
  return doc
}


