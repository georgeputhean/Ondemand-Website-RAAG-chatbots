import puppeteer, { Browser, Page } from 'puppeteer'
import * as cheerio from 'cheerio'
import { parseString } from 'xml2js'
import { promisify } from 'util'

const parseXML = promisify(parseString)

export type CrawledPage = {
  url: string
  title: string
  content: string
}

export type DiscoveredPage = {
  url: string
  title: string
}

export type DiscoveryResult = {
  pages: DiscoveredPage[]
  sitemapFound: boolean
  sitemapUrls: number
  linksDiscovered: number
  filteringStats: {
    totalSitemapUrls: number
    acceptedSitemapUrls: number
    filteredSitemapUrls: number
  }
}

interface CrawlOptions {
  maxDepth?: number
  maxPages?: number
  includePaths?: string[]
  excludePaths?: string[]
  onlyMainContent?: boolean
  respectRobots?: boolean
  userAgent?: string
  discoverOnly?: boolean
}

interface CrawlState {
  visited: Set<string>
  queue: Array<{ url: string; depth: number }>
  results: CrawledPage[]
  domain: string
}

export class GroqCrawler {
  private browser: Browser | null = null
  private options: Required<CrawlOptions>
  private _lastDiscoveryStats: {
    sitemapFound: boolean
    sitemapUrlCount: number
    totalLinksFound: number
    filteringStats: {
      totalSitemapUrls: number
      acceptedSitemapUrls: number
      filteredSitemapUrls: number
    }
  } | null = null

  constructor(options: CrawlOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth ?? 3,
      maxPages: options.maxPages ?? 100,
      includePaths: options.includePaths ?? [],
      excludePaths: options.excludePaths ?? ['/admin', '/login', '/logout', '/search'],
      onlyMainContent: options.onlyMainContent ?? true,
      respectRobots: options.respectRobots ?? true,
      userAgent: options.userAgent ?? 'GroqCrawler/1.0 (+https://github.com/yourusername/groqcrawl-js)',
      discoverOnly: options.discoverOnly ?? false
    }
  }

  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      })
    }
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  private normalizeUrl(url: string, baseUrl: string): string {
    try {
      const base = new URL(baseUrl)
      const resolved = new URL(url, base)

      // Remove fragment
      resolved.hash = ''

      // Remove trailing slash unless it's the root
      if (resolved.pathname !== '/' && resolved.pathname.endsWith('/')) {
        resolved.pathname = resolved.pathname.slice(0, -1)
      }

      return resolved.toString()
    } catch {
      return ''
    }
  }

  private shouldCrawlUrl(url: string, domain: string, depth: number, logFiltering = false): boolean {
    try {
      const urlObj = new URL(url)

      // Only crawl same domain (with normalization)
      const normalizedDomain = domain.replace(/^www\./, '')
      const normalizedUrlDomain = urlObj.hostname.replace(/^www\./, '')

      if (normalizedUrlDomain !== normalizedDomain) {
        if (logFiltering) console.log(`❌ Domain mismatch: ${url} (${normalizedUrlDomain} ≠ ${normalizedDomain})`)
        return false
      }

      // Check depth limit
      if (depth >= this.options.maxDepth) {
        if (logFiltering) console.log(`❌ Depth limit: ${url} (depth ${depth} >= ${this.options.maxDepth})`)
        return false
      }

      // Check exclude paths (more specific for discovery mode)
      const excludePaths = this.options.discoverOnly
        ? ['/admin/', '/login/', '/logout/'] // More specific excludes for discovery
        : this.options.excludePaths

      for (const excludePath of excludePaths) {
        if (urlObj.pathname.startsWith(excludePath)) {
          if (logFiltering) console.log(`❌ Excluded path: ${url} (matches ${excludePath})`)
          return false
        }
      }

      // Check include paths (if specified)
      if (this.options.includePaths.length > 0) {
        const included = this.options.includePaths.some(includePath =>
          urlObj.pathname.startsWith(includePath)
        )
        if (!included) {
          if (logFiltering) console.log(`❌ Not in include paths: ${url}`)
          return false
        }
      }

      // Skip common non-content files (relaxed for discovery mode)
      const skipExtensions = this.options.discoverOnly
        ? ['.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.ico'] // Allow PDFs and images in discovery
        : ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.css', '.js', '.woff', '.woff2', '.ttf', '.eot']

      const hasSkippedExtension = skipExtensions.some(ext => urlObj.pathname.toLowerCase().endsWith(ext))
      if (hasSkippedExtension) {
        if (logFiltering) console.log(`❌ File extension: ${url} (has excluded extension)`)
        return false
      }

      if (logFiltering) console.log(`✅ Accepted: ${url}`)
      return true
    } catch (error) {
      if (logFiltering) console.warn(`❌ Invalid URL: ${url}`, error)
      return false
    }
  }

  private async extractMainContent(html: string): Promise<string> {
    const $ = cheerio.load(html)

    // Remove script and style elements
    $('script, style, nav, header, footer, aside, .nav, .navigation, .menu, .sidebar, .footer, .header').remove()

    // Try to find main content area
    let content = ''

    // Common main content selectors
    const mainSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-content',
      'article',
      '.container .content',
      '.page-content'
    ]

    for (const selector of mainSelectors) {
      const mainElement = $(selector).first()
      if (mainElement.length > 0) {
        content = mainElement.text().trim()
        if (content.length > 100) { // Ensure we have substantial content
          break
        }
      }
    }

    // Fallback to body content if no main content found
    if (!content) {
      content = $('body').text().trim()
    }

    // Clean up whitespace
    content = content.replace(/\s+/g, ' ').trim()

    return content
  }

  private async scrapePage(page: Page, url: string): Promise<CrawledPage | null> {
    try {
      console.log(`Scraping: ${url}`)

      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      })

      if (!response || !response.ok()) {
        console.warn(`Failed to load ${url}: ${response?.status()}`)
        return null
      }

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 1000))

      const title = await page.title()
      const html = await page.content()

      const content = this.options.onlyMainContent
        ? await this.extractMainContent(html)
        : cheerio.load(html)('body').text().trim().replace(/\s+/g, ' ')

      // Skip pages with very little content
      if (content.length < 50) {
        return null
      }

      return {
        url,
        title: title || url,
        content
      }
    } catch (error) {
      console.error(`Error scraping ${url}:`, error)
      return null
    }
  }

  private async discoverPage(page: Page, url: string): Promise<DiscoveredPage | null> {
    try {
      console.log(`Discovering: ${url}`)

      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      })

      if (!response || !response.ok()) {
        console.warn(`Failed to load ${url}: ${response?.status()}`)
        return null
      }

      const title = await page.title()

      return {
        url,
        title: title || url
      }
    } catch (error) {
      console.error(`Error discovering ${url}:`, error)
      return null
    }
  }

  private async findLinksOnPage(page: Page, baseUrl: string): Promise<string[]> {
    try {
      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'))
        return anchors.map(a => (a as HTMLAnchorElement).href)
      })

      console.log(`Found ${links.length} raw links on ${baseUrl}`)

      const domain = new URL(baseUrl).hostname
      const normalizedLinks = links
        .map(link => this.normalizeUrl(link, baseUrl))
        .filter(link => {
          if (!link) return false
          return this.shouldCrawlUrl(link, domain, 0) // No detailed logging for link discovery to avoid spam
        })

      console.log(`After filtering: ${normalizedLinks.length} valid links`)
      return [...new Set(normalizedLinks)] // Remove duplicates
    } catch (error) {
      console.error('Error finding links:', error)
      return []
    }
  }

  private async parseSitemap(sitemapUrl: string): Promise<string[]> {
    try {
      console.log(`Parsing sitemap: ${sitemapUrl}`)

      const response = await fetch(sitemapUrl)
      if (!response.ok) {
        return []
      }

      const xmlContent = await response.text()
      const result = await parseXML(xmlContent) as any

      const urls: string[] = []

      // Handle sitemap index
      if (result.sitemapindex?.sitemap) {
        for (const sitemap of result.sitemapindex.sitemap) {
          if (sitemap.loc?.[0]) {
            const childUrls = await this.parseSitemap(sitemap.loc[0])
            urls.push(...childUrls)
          }
        }
      }

      // Handle URL set
      if (result.urlset?.url) {
        for (const urlEntry of result.urlset.url) {
          if (urlEntry.loc?.[0]) {
            urls.push(urlEntry.loc[0])
          }
        }
      }

      return urls
    } catch (error) {
      console.error('Error parsing sitemap:', error)
      return []
    }
  }

  async crawl(rootUrl: string): Promise<CrawledPage[]> {
    await this.initBrowser()

    if (!this.browser) {
      throw new Error('Failed to initialize browser')
    }

    try {
      const page = await this.browser.newPage()
      await page.setUserAgent(this.options.userAgent)

      const urlObj = new URL(rootUrl)
      const domain = urlObj.hostname

      const state: CrawlState = {
        visited: new Set(),
        queue: [{ url: rootUrl, depth: 0 }],
        results: [],
        domain
      }

      // Track discovery statistics
      let sitemapFound = false
      let sitemapUrlCount = 0
      let totalLinksFound = 0
      let totalSitemapUrls = 0
      let acceptedSitemapUrls = 0

      // Try to get URLs from sitemap first
      const sitemapUrls = await this.parseSitemap(`${urlObj.protocol}//${urlObj.host}/sitemap.xml`)
      if (sitemapUrls.length > 0) {
        sitemapFound = true
        sitemapUrlCount = sitemapUrls.length
        totalSitemapUrls = Math.min(sitemapUrls.length, this.options.maxPages)
        console.log(`Found ${sitemapUrls.length} URLs in sitemap`)
        console.log(`Processing ${totalSitemapUrls} sitemap URLs...`)

        for (const url of sitemapUrls.slice(0, this.options.maxPages)) {
          if (this.shouldCrawlUrl(url, domain, 0, true)) { // Enable detailed logging
            state.queue.push({ url, depth: 0 })
            acceptedSitemapUrls++
          }
        }

        const filteredSitemapUrls = totalSitemapUrls - acceptedSitemapUrls
        console.log(`✅ Accepted: ${acceptedSitemapUrls} URLs | ❌ Filtered: ${filteredSitemapUrls} URLs`)
      } else {
        console.log('No sitemap found or sitemap was empty')
      }

      while (state.queue.length > 0 && state.results.length < this.options.maxPages) {
        const { url, depth } = state.queue.shift()!

        if (state.visited.has(url)) {
          continue
        }

        state.visited.add(url)

        if (this.options.discoverOnly) {
          const discoveredPage = await this.discoverPage(page, url)
          if (discoveredPage) {
            state.results.push(discoveredPage as any) // Type compatibility
            console.log(`Discovered ${state.results.length}/${this.options.maxPages}: ${url}`)
          }
        } else {
          const scrapedPage = await this.scrapePage(page, url)
          if (scrapedPage) {
            state.results.push(scrapedPage)
            console.log(`Scraped ${state.results.length}/${this.options.maxPages}: ${url}`)
          }
        }

        // Find more links if we haven't reached max depth
        if (depth < this.options.maxDepth - 1) {
          const links = await this.findLinksOnPage(page, url)
          totalLinksFound += links.length
          for (const link of links) {
            if (!state.visited.has(link) && this.shouldCrawlUrl(link, domain, depth + 1)) {
              state.queue.push({ url: link, depth: depth + 1 })
            }
          }
        }

        // Add small delay to be respectful
        const delay = this.options.discoverOnly ? 200 : 500 // Faster for discovery
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      await page.close()

      // Store discovery stats for later retrieval
      this._lastDiscoveryStats = {
        sitemapFound,
        sitemapUrlCount,
        totalLinksFound,
        filteringStats: {
          totalSitemapUrls,
          acceptedSitemapUrls,
          filteredSitemapUrls: totalSitemapUrls - acceptedSitemapUrls
        }
      }

      return state.results

    } finally {
      await this.closeBrowser()
    }
  }

  async discover(rootUrl: string): Promise<DiscoveredPage[]> {
    const originalDiscoverOnly = this.options.discoverOnly
    this.options.discoverOnly = true

    try {
      const results = await this.crawl(rootUrl)
      return results as DiscoveredPage[]
    } finally {
      this.options.discoverOnly = originalDiscoverOnly
    }
  }

  getLastDiscoveryStats() {
    return this._lastDiscoveryStats || {
      sitemapFound: false,
      sitemapUrlCount: 0,
      totalLinksFound: 0,
      filteringStats: {
        totalSitemapUrls: 0,
        acceptedSitemapUrls: 0,
        filteredSitemapUrls: 0
      }
    }
  }
}

// Convenience function that matches Firecrawl interface
export async function crawlWebsite(rootUrl: string): Promise<CrawledPage[]> {
  const crawler = new GroqCrawler({
    maxDepth: 3,
    maxPages: 100,
    onlyMainContent: true
  })

  return await crawler.crawl(rootUrl)
}

// Convenience function for URL discovery
export async function discoverWebsiteUrls(rootUrl: string): Promise<DiscoveryResult> {
  const crawler = new GroqCrawler({
    maxDepth: 3,
    maxPages: 200, // More pages for discovery since it's faster
    discoverOnly: true
  })

  const pages = await crawler.discover(rootUrl)
  const stats = crawler.getLastDiscoveryStats()

  return {
    pages,
    sitemapFound: stats.sitemapFound,
    sitemapUrls: stats.sitemapUrlCount,
    linksDiscovered: stats.totalLinksFound,
    filteringStats: stats.filteringStats
  }
}