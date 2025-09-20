import OpenAI from 'openai'

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function embedText(texts: string[], model = 'text-embedding-3-small'): Promise<number[][]> {
  const batchSize = 64
  const vectors: number[][] = []
  for (let i = 0; i < texts.length; i += batchSize) {
    const chunk = texts.slice(i, i + batchSize)
    const res = await openai.embeddings.create({ model, input: chunk })
    vectors.push(...res.data.map(d => d.embedding as number[]))
  }
  return vectors
}

export async function chatWithContext(prompt: string, context: { url: string; title: string; content: string }[], model = 'gpt-4o-mini', systemPrompt?: string) {
  const system = systemPrompt || `You are a helpful assistant for a business website. Answer based only on the provided CONTEXT. Cite sources using their titles and URLs at the end. If unsure, say you don't know.`
  
  // Limit context to stay under token limit (roughly 6000 tokens max)
  let contextText = ''
  let tokenCount = 0
  const maxTokens = 6000
  
  for (const c of context) {
    const chunk = `Source: ${c.title}\nURL: ${c.url}\n---\n${c.content}\n\n`
    const chunkTokens = chunk.split(/\s+/).length * 1.3 // rough token estimate
    
    if (tokenCount + chunkTokens > maxTokens) break
    
    contextText += chunk
    tokenCount += chunkTokens
  }
  
  const messages = [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: `CONTEXT:\n${contextText}\n\nQUESTION: ${prompt}` }
  ]
  const res = await openai.chat.completions.create({ model, messages, temperature: 0.2 })
  return res.choices[0]?.message?.content ?? ''
}


