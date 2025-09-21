import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get total count
    const { count: totalCount } = await supabaseAdmin
      .from('pages')
      .select('*', { count: 'exact', head: true })
    
    // Get sample business to check chunks
    const { data: sampleBusiness } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .limit(1)
      .single()

    let embeddedCount = 0
    if (sampleBusiness) {
      try {
        const chunkTableName = `chunks_${sampleBusiness.id.replace(/-/g, '')}`
        const { count } = await supabaseAdmin
          .from(chunkTableName as any)
          .select('*', { count: 'exact', head: true })
          .not('embedding', 'is', null)
        embeddedCount = count || 0
      } catch (err) {
        // Chunk table might not exist
        embeddedCount = 0
      }
    }
    
    // Get sample data
    const { data: sampleData } = await supabaseAdmin
      .from('pages')
      .select('url, title, raw_content, is_processed')
      .limit(5)
    
    // Check for milkshake content specifically
    const { data: milkshakeData } = await supabaseAdmin
      .from('pages')
      .select('url, title, raw_content')
      .ilike('raw_content', '%milkshake%')
      .limit(3)
    
    // Get chunk table info for debugging
    let chunkTableInfo = null
    if (sampleBusiness) {
      const chunkTableName = `chunks_${sampleBusiness.id.replace(/-/g, '')}`
      try {
        const { data: chunkSample } = await supabaseAdmin
          .from(chunkTableName as any)
          .select('id, content, chunk_index, total_chunks, embedding')
          .limit(3)

        chunkTableInfo = {
          tableName: chunkTableName,
          businessId: sampleBusiness.id,
          sampleChunks: chunkSample?.map(chunk => ({
            id: chunk.id,
            contentPreview: chunk.content?.substring(0, 100) + '...',
            chunkIndex: chunk.chunk_index,
            totalChunks: chunk.total_chunks,
            hasEmbedding: !!chunk.embedding
          }))
        }
      } catch (err: any) {
        chunkTableInfo = {
          tableName: chunkTableName,
          businessId: sampleBusiness.id,
          error: err.message
        }
      }
    }

    return NextResponse.json({
      totalPages: totalCount,
      embeddedChunks: embeddedCount,
      sampleData,
      milkshakeContent: milkshakeData,
      hasEmbeddings: (embeddedCount ?? 0) > 0,
      chunkTableInfo,
      instructions: {
        message: "Visit /chat?businessId=YOUR_BUSINESS_ID to test the chat",
        example: sampleBusiness ? `/chat?businessId=${sampleBusiness.id}` : "Register a business first"
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
