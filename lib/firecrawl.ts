// Simple Firecrawl wrapper using v2 API.
const FIRECRAWL_URL = 'https://api.firecrawl.dev/v2'

export type CrawledPage = {
  url: string
  title: string
  content: string
}

export async function crawlWebsite(rootUrl: string): Promise<CrawledPage[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) throw new Error('Missing FIRECRAWL_API_KEY')
  
  // Start crawl job (v2)
  const crawlRes = await fetch(`${FIRECRAWL_URL}/crawl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: rootUrl,
      sitemap: 'include',
      crawlEntireDomain: false,
      limit: 100,
      scrapeOptions: {
        onlyMainContent: true,
        maxAge: 172800000,
        parsers: ['pdf'],
        formats: ['markdown']
      }
    }),
  })
  
  if (!crawlRes.ok) {
    const t = await crawlRes.text()
    throw new Error(`Firecrawl crawl failed: ${crawlRes.status} ${t}`)
  }
  
  const crawlData = await crawlRes.json()
  const jobId = crawlData.jobId || crawlData.job_id || crawlData.id
  
  if (!jobId) {
    throw new Error('No job ID returned from Firecrawl')
  }
  
  // Poll for completion
  let attempts = 0
  const maxAttempts = 60
  
  while (attempts < maxAttempts) {
    const waitMs = Math.min(10000, 2000 * Math.max(1, attempts))
    await new Promise(resolve => setTimeout(resolve, waitMs))
    
    // Check crawl status (v2)
    let statusData: any | null = null
    try {
      const statusRes = await fetch(`${FIRECRAWL_URL}/crawl/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      })
      if (!statusRes.ok) {
        // Treat transient 5xx as retryable
        if (statusRes.status >= 500) {
          attempts++
          continue
        }
        throw new Error(`Failed to check crawl status: ${statusRes.status}`)
      }
      statusData = await statusRes.json()
    } catch (e) {
      // Network/transient error -> retry
      attempts++
      continue
    }
    
    if (statusData.status === 'completed' || statusData.state === 'completed' || statusData.job?.status === 'completed') {
      // v2 returns results with the status payload
      const resultList = statusData.data || statusData.results || statusData.job?.results || []
      const pages: CrawledPage[] = (resultList as any[]).map((p: any) => ({
        url: p.metadata?.sourceURL || p.url || p.sourceURL,
        title: p.metadata?.title || p.title || p.url,
        content: (p.markdown || p.extract || p.content || p.text || '').trim(),
      }))
      
      // Basic cleanup: remove very short or boilerplate-only pages
      return pages.filter(p => p.content && p.content.split(/\s+/).length > 30)
    }
    
    if (statusData.status === 'failed' || statusData.state === 'failed' || statusData.job?.status === 'failed') {
      throw new Error(`Crawl failed: ${statusData.error || 'Unknown error'}`)
    }
    
    attempts++
  }
  
  throw new Error('Crawl timed out')
}


