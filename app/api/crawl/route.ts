import { NextResponse } from 'next/server'
import { z } from 'zod'
import { crawlWebsite } from '@/lib/groqcrawl'
import { embedText } from '@/lib/openai'
import { upsertPages, upsertDocument } from '@/lib/rag'
import { supabaseAdmin } from '@/lib/supabase'
import { ensureChunkTable, getChunkTableName } from '@/lib/chunk-table-fallback'

const schema = z.object({
  url: z.string().url(),
  businessId: z.string().uuid().optional(),
  businessName: z.string().optional(),
  customPrompt: z.string().optional(),
  additionalUrls: z.array(z.string().url()).optional()
})

export async function POST(request: Request) {
  try {
    // Handle both FormData and JSON requests
    const contentType = request.headers.get('content-type')
    let url: string, businessId: string | undefined, businessName: string | undefined, customPrompt: string | undefined
    let additionalUrls: string[] = []
    let documents: File[] = []

    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData (with file uploads)
      const formData = await request.formData()
      url = formData.get('url') as string
      businessId = formData.get('businessId') as string || undefined
      businessName = formData.get('businessName') as string || undefined
      customPrompt = formData.get('customPrompt') as string || undefined

      // Get additional URLs
      const additionalUrlsData = formData.getAll('additionalUrls') as string[]
      additionalUrls = additionalUrlsData.filter(url => url.trim())

      // Get uploaded documents
      const uploadedDocs = formData.getAll('documents') as File[]
      documents = uploadedDocs.filter(doc => doc instanceof File && doc.size > 0)
    } else {
      // Handle JSON request (backward compatibility)
      const body = await request.json()
      const parsed = schema.parse(body)
      url = parsed.url
      businessId = parsed.businessId
      businessName = parsed.businessName
      customPrompt = parsed.customPrompt
      additionalUrls = parsed.additionalUrls || []
    }

    // Validate URL
    if (!url || !URL.canParse(url)) {
      throw new Error('Valid URL is required')
    }

    // Use provided businessId or find/create business by URL/domain
    let finalBusinessId: string

    if (businessId) {
      // Verify the business exists
      const { data: business, error: fetchError } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('id', businessId)
        .single()

      if (fetchError || !business) {
        throw new Error(`Business not found: ${fetchError?.message || 'No business data'}`)
      }

      finalBusinessId = businessId

      // Update business with custom prompt if provided
      if (customPrompt) {
        await supabaseAdmin
          .from('businesses')
          .update({ system_prompt: customPrompt })
          .eq('id', finalBusinessId)
      }
    } else {
      // Legacy: Find or create business by URL/domain (for backward compatibility)
      const domain = new URL(url).hostname
      const { data: existingBusiness } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('domain', domain)
        .maybeSingle()

      if (existingBusiness) {
        finalBusinessId = existingBusiness.id
      } else {
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
        finalBusinessId = created.id
      }
    }
    
    // Step 1: Ensure chunk table exists for this business (with fallback)
    try {
      const tableName = await ensureChunkTable(finalBusinessId)
      console.log(`Successfully ensured chunk table exists: ${tableName}`)
    } catch (err: any) {
      console.error('Failed to create chunk table:', err)
      throw new Error(`Could not create chunk table for business: ${finalBusinessId}. ${err.message}`)
    }

    const chunkTableName = getChunkTableName(finalBusinessId)

    // Step 2: Get selected URLs BEFORE clearing anything
    console.log('Checking for selected pages for business:', finalBusinessId)
    const { data: selectedPages, error: selectedError } = await supabaseAdmin
      .from('pages')
      .select('url, title, id, is_selected')
      .eq('business_id', finalBusinessId)
      .eq('is_selected', true)

    if (selectedError) {
      console.warn('Failed to fetch selected pages:', selectedError)
      throw new Error(`Failed to fetch selected pages: ${selectedError.message}`)
    }

    console.log('Selected pages found:', selectedPages)

    // Step 3: Conditional processing based on selection
    let allPages: any[] = []
    let usingExistingContent = false

    if (selectedPages && selectedPages.length > 0) {
      console.log(`Found ${selectedPages.length} selected pages - will crawl fresh content`)

      // SELECTED PAGES: Clear existing content and re-scrape
      // Clear pages table
      const { error: deleteError } = await supabaseAdmin
        .from('pages')
        .delete()
        .eq('business_id', finalBusinessId)

      if (deleteError) {
        console.warn('Failed to clear existing pages:', deleteError)
      }

      // Clear chunks table (now we know it exists)
      const { error: chunkDeleteError } = await supabaseAdmin
        .from(chunkTableName as any)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

      if (chunkDeleteError) {
        console.warn('Failed to clear existing chunks:', chunkDeleteError)
      }

      console.log(`Crawling ${selectedPages.length} selected URLs`)
    } else {
      console.log('No pages selected - checking for existing content in database')

      // NO SELECTION: Use existing content from database
      const { data: existingPages, error: existingError } = await supabaseAdmin
        .from('pages')
        .select('id, url, title, is_processed')
        .eq('business_id', finalBusinessId)
        .eq('is_processed', true)

      if (existingError) {
        console.error('Failed to fetch existing pages:', existingError)
        throw new Error(`Failed to check existing content: ${existingError.message}`)
      }

      if (!existingPages || existingPages.length === 0) {
        throw new Error('No content available for this business. Please go back and:\n\n1. Click "Discover Website URLs" to find pages\n2. Select which pages you want to include\n3. Then configure your chatbot\n\nAlternatively, add additional URLs or upload documents.')
      }

      console.log(`Found ${existingPages.length} existing processed pages - using existing content`)
      usingExistingContent = true
      // Skip crawling phase entirely when using existing content
    }

    // Step 4: Crawl selected pages (only if pages are selected)
    if (selectedPages && selectedPages.length > 0) {
      // Crawl only the selected URLs - no fallback to traditional crawling
      for (const selectedPage of selectedPages) {
        try {
          console.log(`Crawling selected URL: ${selectedPage.url}`)

          // Create a focused crawler for this specific URL
          const { GroqCrawler } = await import('@/lib/groqcrawl')
          const crawler = new GroqCrawler({
            maxDepth: 1, // Only this specific URL, no following links
            maxPages: 1,
            onlyMainContent: true,
            discoverOnly: false // We want full content crawling
          })

          const crawledPages = await crawler.crawl(selectedPage.url)
          allPages = allPages.concat(crawledPages)

          // Mark this page as processed in the database
          await supabaseAdmin
            .from('pages')
            .update({ is_processed: true })
            .eq('id', selectedPage.id)

        } catch (err) {
          console.warn(`Failed to crawl selected URL ${selectedPage.url}:`, err)
          // Continue with other pages even if one fails
        }
      }
    }

    // Crawl additional URLs if provided
    for (const additionalUrl of additionalUrls) {
      try {
        const additionalPages = await crawlWebsite(additionalUrl)
        allPages = allPages.concat(additionalPages)
      } catch (err) {
        console.warn(`Failed to crawl additional URL ${additionalUrl}:`, err)
      }
    }
    
    // Step 5: Store pages as chunks (only if we crawled new content)
    if (!usingExistingContent && allPages.length > 0) {
      await upsertPages(allPages.map(p => ({ businessId: finalBusinessId, url: p.url, title: p.title, content: p.content })))
    }

    // Step 6: Get all chunks and generate embeddings (for both new and existing content)
    const { data: chunks } = await supabaseAdmin
      .from(chunkTableName as any)
      .select('id, content')
      .is('embedding', null)

    let processedChunks = 0
    const totalChunks = chunks?.length || 0

    if (chunks && chunks.length > 0) {
      console.log(`Processing embeddings for ${chunks.length} chunks`)

      // Process embeddings in batches to avoid rate limits
      const batchSize = 10
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize)
        const contents = batch.map(c => c.content)

        try {
          console.log(`Generating embeddings for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`)
          const vectors = await embedText(contents)

          // Update batch with embeddings
          for (let j = 0; j < batch.length; j++) {
            await supabaseAdmin
              .from(chunkTableName as any)
              .update({ embedding: vectors[j] })
              .eq('id', batch[j].id)
          }

          processedChunks += batch.length
          console.log(`Successfully processed ${processedChunks}/${chunks.length} chunks`)
        } catch (embeddingError: any) {
          console.error(`Failed to process embedding batch ${Math.floor(i/batchSize) + 1}:`, {
            error: embeddingError.message,
            batchSize: batch.length,
            contentLengths: contents.map(c => c.length)
          })
          throw new Error(`Failed to generate embeddings: ${embeddingError.message}`)
        }
      }
    }

    // Step 5: Process uploaded documents
    let documentsProcessed = 0
    if (documents.length > 0) {
      for (const doc of documents) {
        try {
          const content = await doc.text()
          await upsertDocument(
            finalBusinessId!,
            doc.name,
            doc.type,
            doc.size,
            content
          )

          // Generate embedding for the document
          console.log(`Generating embedding for document: ${doc.name}`)
          const [docEmbedding] = await embedText([content])
          await supabaseAdmin
            .from('documents')
            .update({ embedding: docEmbedding })
            .eq('business_id', finalBusinessId)
            .eq('filename', doc.name)

          documentsProcessed++
          console.log(`Successfully processed document: ${doc.name}`)
        } catch (err: any) {
          console.error(`Failed to process document ${doc.name}:`, err.message)
          // Don't throw here, just log and continue with other documents
        }
      }
    }

    // Generate appropriate success message based on processing type
    let message: string
    if (usingExistingContent) {
      message = documentsProcessed > 0
        ? `Successfully configured chatbot using existing content (${totalChunks} chunks) and processed ${documentsProcessed} new documents. Generated ${processedChunks} new embeddings. Your chatbot is ready!`
        : `Successfully configured chatbot using existing content with ${totalChunks} chunks and ${processedChunks} new embeddings. Your chatbot is ready!`
    } else {
      message = documentsProcessed > 0
        ? `Successfully crawled ${allPages.length} pages, processed ${documentsProcessed} documents, and created ${totalChunks} content chunks with embeddings. Your chatbot is ready!`
        : `Successfully crawled ${allPages.length} pages and created ${totalChunks} content chunks with embeddings. Your chatbot is ready!`
    }

    return NextResponse.json({
      ok: true,
      message,
      stats: {
        pagesCrawled: usingExistingContent ? 0 : allPages.length,
        documentsProcessed,
        chunksCreated: totalChunks,
        embeddingsGenerated: processedChunks,
        usingExistingContent,
        domainCleared: usingExistingContent ? null : new URL(url).hostname,
        finalBusinessId
      },
      finalBusinessId
    })
  } catch (err: any) {
    console.error('Crawl API error:', {
      error: err.message,
      stack: err.stack,
      name: err.name
    })
    return NextResponse.json({
      error: err.message || 'Failed to process request',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 400 })
  }
}


