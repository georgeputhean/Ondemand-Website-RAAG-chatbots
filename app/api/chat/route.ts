import { openai } from '@ai-sdk/openai'
import { streamText, pipeTextStreamToResponse } from 'ai'
import { z } from 'zod'
import { embedText } from '@/lib/openai'
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
    if (!lastUser) {
      return new Response('No user message found', { status: 400 })
    }

    console.log('User query:', lastUser.content)

    // Generate embedding for the query
    const [queryEmbedding] = await embedText([lastUser.content])
    console.log('Query embedding generated, length:', queryEmbedding.length)

    // Find similar chunks from database
    const matches = await querySimilar(queryEmbedding, 8, business_id)
    console.log('Found matches:', matches.length)

    let context = ''
    let sources: { title: string; url: string }[] = []

    if (matches.length === 0) {
      // Fallback: try text search if vector search fails
      const { data: textMatches } = await supabaseAdmin
        .from('pages')
        .select('url, title, raw_content')
        .ilike('raw_content', `%${lastUser.content.toLowerCase()}%`)
        .limit(5)

      console.log('Text search matches:', textMatches?.length || 0)

      if (textMatches && textMatches.length > 0) {
        context = textMatches.map(m => `Title: ${m.title}\nContent: ${m.raw_content}`).join('\n\n')
        // Clean Unicode characters from text search sources too
        sources = textMatches.map(m => ({
          title: m.title.replace(/[^\x00-\xFF]/g, '?'),
          url: m.url.replace(/[^\x00-\xFF]/g, '')
        }))
      }
    } else {
      // Prepare context from vector matches
      context = matches.map(m => `Title: ${m.page_title}\nContent: ${m.content}`).join('\n\n')

      // Get unique sources - clean any unicode characters that could cause header issues
      sources = matches.reduce((acc, m) => {
        if (!acc.find(s => s.url === m.page_url)) {
          // Remove or replace problematic Unicode characters
          const cleanTitle = m.page_title.replace(/[^\x00-\xFF]/g, '?') // Replace non-ASCII with ?
          const cleanUrl = m.page_url.replace(/[^\x00-\xFF]/g, '') // Remove non-ASCII from URLs
          acc.push({ title: cleanTitle, url: cleanUrl })
        }
        return acc
      }, [] as { title: string; url: string }[])
    }

    // Fetch business-specific system prompt
    let systemPrompt = 'You are a helpful assistant. Use the provided context to answer questions accurately and cite your sources.'
    if (business_id) {
      const { data: biz } = await supabaseAdmin
        .from('businesses')
        .select('system_prompt')
        .eq('id', business_id)
        .maybeSingle()
      if (biz?.system_prompt) {
        systemPrompt = biz.system_prompt
      }
    }

    // Create the context-aware prompt
    const contextPrompt = context
      ? `Context:\n${context}\n\nBased on the above context, please answer the following question. If the context doesn't contain relevant information, say so clearly.\n\nQuestion: ${lastUser.content}`
      : `I don't have any specific context about your question: ${lastUser.content}. Please make sure the website has been crawled and indexed first.`

    // Create messages array for streaming
    const streamMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.slice(0, -1), // All previous messages except the last user message
      { role: 'user' as const, content: contextPrompt }
    ]

    // Stream the response
    const result = streamText({
      model: openai('gpt-4o-mini'),
      messages: streamMessages,
      temperature: 0.7,
    })

    // Create a basic streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            // Properly escape the chunk content for JSON
            const escapedChunk = JSON.stringify(chunk)
            controller.enqueue(new TextEncoder().encode(`0:${escapedChunk}\n`))
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Sources': Buffer.from(JSON.stringify(sources), 'utf8').toString('base64'),
      },
    })

  } catch (err: any) {
    console.error('Chat error:', err)
    return new Response('Chat failed: ' + err.message, { status: 500 })
  }
}


