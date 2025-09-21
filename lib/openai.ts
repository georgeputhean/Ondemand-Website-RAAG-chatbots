import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 second timeout
  maxRetries: 3,
})

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      // Don't retry on authentication errors
      if (error?.status === 401 || error?.status === 403) {
        throw error
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error
      }

      // Wait before retrying (exponential backoff)
      const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000)
      console.log(`OpenAI request failed (attempt ${attempt + 1}), retrying in ${waitTime}ms:`, error.message)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  throw lastError!
}

export async function embedText(texts: string[], model = 'text-embedding-3-small'): Promise<number[][]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const batchSize = 64
  const vectors: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const chunk = texts.slice(i, i + batchSize)

    const res = await retryWithBackoff(async () => {
      return await openai.embeddings.create({
        model,
        input: chunk,
        encoding_format: 'float'
      })
    })

    vectors.push(...res.data.map(d => d.embedding as number[]))
  }

  return vectors
}

export async function chatWithContext(prompt: string, context: { url: string; title: string; content: string }[], model = 'gpt-4o-mini', systemPrompt?: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

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

  const res = await retryWithBackoff(async () => {
    return await openai.chat.completions.create({ model, messages, temperature: 0.2 })
  })

  return res.choices[0]?.message?.content ?? ''
}


