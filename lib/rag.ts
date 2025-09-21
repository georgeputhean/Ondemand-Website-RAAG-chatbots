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
  if (!pages.length) return

  const businessId = pages[0].businessId

  // Step 1: Get chunk table name (table should already exist)
  const chunkTableName = `chunks_${businessId.replace(/-/g, '')}`

  // Step 2: Store page metadata in pages table
  const pageRows = pages.map(page => ({
    business_id: businessId,
    url: page.url,
    title: page.title,
    raw_content: page.content,
    is_processed: false
  }))

  const { data: insertedPages, error: pageError } = await supabaseAdmin
    .from('pages')
    .upsert(pageRows, { onConflict: 'business_id,url', ignoreDuplicates: false })
    .select('id, url, raw_content')

  if (pageError) throw pageError

  // Step 3: Process chunks for each page

  for (const page of insertedPages || []) {
    const contentChunks = chunkContent(page.raw_content)

    // Clear existing chunks for this page
    await supabaseAdmin
      .from(chunkTableName as any)
      .delete()
      .eq('page_id', page.id)

    // Insert new chunks
    const chunkRows = contentChunks.map((chunk, index) => ({
      page_id: page.id,
      content: chunk,
      chunk_index: index,
      total_chunks: contentChunks.length,
      embedding: null
    }))

    if (chunkRows.length > 0) {
      const { error: chunkError } = await supabaseAdmin
        .from(chunkTableName as any)
        .insert(chunkRows)

      if (chunkError) throw chunkError
    }
  }

  // Step 4: Mark pages as processed
  await supabaseAdmin
    .from('pages')
    .update({ is_processed: true })
    .eq('business_id', businessId)
}

export async function querySimilar(queryEmbedding: number[], topK = 5, businessId?: string) {
  // If no businessId provided, return empty results
  if (!businessId) return []

  try {
    // Try the stored procedure approach first
    let { data, error } = await supabaseAdmin.rpc('match_business_chunks', {
      business_uuid: businessId,
      query_embedding: queryEmbedding,
      match_count: topK,
      similarity_threshold: 0.1,
    })

    // If no results, try with even lower threshold
    if (!data || data.length === 0) {
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin.rpc('match_business_chunks', {
        business_uuid: businessId,
        query_embedding: queryEmbedding,
        match_count: topK,
        similarity_threshold: 0,
      })

      if (!fallbackError && fallbackData) {
        data = fallbackData
      }
    }

    if (!error && data && data.length > 0) {
      return data as { id: string; page_url: string; page_title: string; content: string; similarity: number }[]
    }
  } catch (err) {
    console.warn('Stored procedure search failed, trying direct table query:', err)
  }

  // Fallback: Direct table query approach
  try {
    const chunkTableName = `chunks_${businessId.replace(/-/g, '')}`

    // Query the chunk table directly
    const { data: chunks, error: chunkError } = await supabaseAdmin
      .from(chunkTableName as any)
      .select(`
        id,
        content,
        embedding,
        page_id,
        pages!inner(url, title, business_id)
      `)
      .not('embedding', 'is', null)
      .eq('pages.business_id', businessId)
      .limit(topK * 2) // Get more than needed for similarity calculation

    if (chunkError) {
      console.error('Direct chunk table query failed:', chunkError)
      return []
    }

    if (!chunks || chunks.length === 0) {
      return []
    }

    // Calculate similarity and sort
    const results = chunks
      .map((chunk: any) => {
        const similarity = cosineSimilarity(queryEmbedding, chunk.embedding)
        return {
          id: chunk.id,
          page_url: chunk.pages.url,
          page_title: chunk.pages.title,
          content: chunk.content,
          similarity
        }
      })
      .filter(result => result.similarity > 0.1) // Filter by similarity threshold
      .sort((a, b) => b.similarity - a.similarity) // Sort by similarity desc
      .slice(0, topK) // Take top K

    return results
  } catch (err) {
    console.error('Direct table query also failed:', err)
    return []
  }
}

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  if (normA === 0 || normB === 0) return 0

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
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


