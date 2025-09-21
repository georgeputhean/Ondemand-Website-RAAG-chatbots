import { NextResponse } from 'next/server'
import { z } from 'zod'
import { embedText, chatWithContext } from '@/lib/openai'
import { querySimilar } from '@/lib/rag'
import { supabaseAdmin } from '@/lib/supabase'

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant', 'system']), content: z.string() })),
  business_id: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { messages, business_id } = schema.parse(body)
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (!lastUser) return NextResponse.json({ error: 'No user message' }, { status: 400 })

    console.log('User query:', lastUser.content)

    // Generate embedding for the query
    const [queryEmbedding] = await embedText([lastUser.content])
    console.log('Query embedding generated, length:', queryEmbedding.length)
    
    // Find similar chunks from database
    const matches = await querySimilar(queryEmbedding, 8, business_id) // Scoped to business
    console.log('Found matches:', matches.length)
    
    if (matches.length === 0) {
      // Fallback: try text search if vector search fails
      const { data: textMatches } = await supabaseAdmin
        .from('pages')
        .select('url, title, content')
        .ilike('content', `%${lastUser.content.toLowerCase()}%`)
        .limit(5)
      
      console.log('Text search matches:', textMatches?.length || 0)
      
      if (textMatches && textMatches.length > 0) {
        const context = textMatches.map(m => ({ 
          url: m.url, 
          title: m.title, 
          content: m.content 
        }))
        
        const answer = await chatWithContext(lastUser.content, context)
        const sources = textMatches.map(m => ({ title: m.title, url: m.url }))
        
        return NextResponse.json({ answer, sources })
      }
      
      return NextResponse.json({ 
        answer: "I don't have any information about that topic. Please make sure the website has been crawled and indexed first.",
        sources: []
      })
    }

    // Log match details for debugging
    console.log('Vector matches:', matches.map(m => ({
      title: m.page_title,
      similarity: m.similarity,
      contentPreview: m.content.substring(0, 100)
    })))

    // Removed follow-up enforcement; behavior driven by optional system prompt instead

    // Prepare context (already chunked, so no need to slice)
    const context = matches.map(m => ({
      url: m.page_url,
      title: m.page_title,
      content: m.content
    }))
    
    // Fetch business-specific system prompt if provided
    let systemPrompt: string | undefined
    if (business_id) {
      const { data: biz } = await supabaseAdmin
        .from('businesses')
        .select('system_prompt')
        .eq('id', business_id)
        .maybeSingle()
      systemPrompt = biz?.system_prompt || undefined
    }

    // Generate answer with context
    const answer = await chatWithContext(lastUser.content, context, undefined, systemPrompt)
    
    // Get unique sources
    const uniqueSources = matches.reduce((acc, m) => {
      if (!acc.find(s => s.url === m.page_url)) {
        acc.push({ title: m.page_title, url: m.page_url })
      }
      return acc
    }, [] as { title: string; url: string }[])

    console.log('Generated answer:', answer.substring(0, 100))
    console.log('Sources:', uniqueSources.length)

    return NextResponse.json({ answer, sources: uniqueSources })
  } catch (err: any) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 400 })
  }
}


