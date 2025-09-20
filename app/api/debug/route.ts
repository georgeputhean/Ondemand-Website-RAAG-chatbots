import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get total count
    const { count: totalCount } = await supabaseAdmin
      .from('pages')
      .select('*', { count: 'exact', head: true })
    
    // Get count with embeddings
    const { count: embeddedCount } = await supabaseAdmin
      .from('pages')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null)
    
    // Get sample data
    const { data: sampleData } = await supabaseAdmin
      .from('pages')
      .select('url, title, content, chunk_index, total_chunks')
      .limit(5)
    
    // Check for milkshake content specifically
    const { data: milkshakeData } = await supabaseAdmin
      .from('pages')
      .select('url, title, content')
      .ilike('content', '%milkshake%')
      .limit(3)
    
    return NextResponse.json({
      totalChunks: totalCount,
      embeddedChunks: embeddedCount,
      sampleData,
      milkshakeContent: milkshakeData,
      hasEmbeddings: embeddedCount > 0
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
