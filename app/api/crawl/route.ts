import { NextResponse } from 'next/server'
import { z } from 'zod'
import { crawlWebsite } from '@/lib/firecrawl'
import { embedText } from '@/lib/openai'
import { upsertPages, upsertDocument } from '@/lib/rag'
import { supabaseAdmin } from '@/lib/supabase'

const schema = z.object({
  url: z.string().url(),
  businessName: z.string().optional(),
  customPrompt: z.string().optional()
})

export async function POST(request: Request) {
  try {
    // Handle both FormData and JSON requests
    const contentType = request.headers.get('content-type')
    let url: string, businessName: string | undefined, customPrompt: string | undefined
    let documents: File[] = []

    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData (with file uploads)
      const formData = await request.formData()
      url = formData.get('url') as string
      businessName = formData.get('businessName') as string || undefined
      customPrompt = formData.get('customPrompt') as string || undefined

      // Get uploaded documents
      const uploadedDocs = formData.getAll('documents') as File[]
      documents = uploadedDocs.filter(doc => doc instanceof File && doc.size > 0)
    } else {
      // Handle JSON request (backward compatibility)
      const body = await request.json()
      const parsed = schema.parse(body)
      url = parsed.url
      businessName = parsed.businessName
      customPrompt = parsed.customPrompt
    }

    // Validate URL
    if (!url || !URL.canParse(url)) {
      throw new Error('Valid URL is required')
    }

    // Find or create business by URL/domain
    const domain = new URL(url).hostname
    const { data: existingBusiness } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('domain', domain)
      .maybeSingle()

    let businessId = existingBusiness?.id as string | undefined
    if (!businessId) {
      const { data: created, error: createErr } = await supabaseAdmin
        .from('businesses')
        .insert({
          url,
          domain,
          business_name: businessName,
          system_prompt: customPrompt
        })
        .select('id')
        .single()
      if (createErr) throw createErr
      businessId = created.id
    }
    // If customPrompt or businessName is provided for an existing business, update it
    else if (customPrompt || businessName) {
      const updateData: any = {}
      if (customPrompt) updateData.system_prompt = customPrompt
      if (businessName) updateData.business_name = businessName

      await supabaseAdmin
        .from('businesses')
        .update(updateData)
        .eq('id', businessId)
    }
    
    // Step 1: Clear existing content for this domain
    const { error: deleteError } = await supabaseAdmin
      .from('pages')
      .delete()
      .eq('business_id', businessId)
    
    if (deleteError) {
      console.warn('Failed to clear existing content:', deleteError)
    }

    // Step 2: Crawl website
    const pages = await crawlWebsite(url)
    
    // Step 3: Store pages as chunks (without embeddings)
    await upsertPages(pages.map(p => ({ businessId: businessId!, url: p.url, title: p.title, content: p.content })))
    
    // Step 4: Get all chunks and generate embeddings
    const { data: chunks } = await supabaseAdmin
      .from('pages')
      .select('id, content, url, title')
      .is('embedding', null)
      .eq('business_id', businessId)
    
    let processedChunks = 0
    const totalChunks = chunks?.length || 0
    
    if (chunks && chunks.length > 0) {
      // Process embeddings in batches to avoid rate limits
      const batchSize = 10
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize)
        const contents = batch.map(c => c.content)
        const vectors = await embedText(contents)
        
        // Update batch with embeddings
        for (let j = 0; j < batch.length; j++) {
          await supabaseAdmin
            .from('pages')
            .update({ embedding: vectors[j] })
            .eq('id', batch[j].id)
        }
        
        processedChunks += batch.length
      }
    }

    // Step 5: Process uploaded documents
    let documentsProcessed = 0
    if (documents.length > 0) {
      for (const doc of documents) {
        try {
          const content = await doc.text()
          await upsertDocument(
            businessId!,
            doc.name,
            doc.type,
            doc.size,
            content
          )

          // Generate embedding for the document
          const [docEmbedding] = await embedText([content])
          await supabaseAdmin
            .from('documents')
            .update({ embedding: docEmbedding })
            .eq('business_id', businessId)
            .eq('filename', doc.name)

          documentsProcessed++
        } catch (err) {
          console.warn(`Failed to process document ${doc.name}:`, err)
        }
      }
    }

    const message = documentsProcessed > 0
      ? `Successfully crawled ${pages.length} pages, processed ${documentsProcessed} documents, and created ${totalChunks} content chunks with embeddings. Your chatbot is ready!`
      : `Successfully crawled ${pages.length} pages and created ${totalChunks} content chunks with embeddings. Your chatbot is ready!`

    return NextResponse.json({
      ok: true,
      message,
      stats: {
        pagesCrawled: pages.length,
        documentsProcessed,
        chunksCreated: totalChunks,
        embeddingsGenerated: processedChunks,
        domainCleared: domain,
        businessId
      },
      businessId
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 400 })
  }
}


