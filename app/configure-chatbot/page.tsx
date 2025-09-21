'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type DiscoveredPage = {
  id: string
  url: string
  title: string
  is_selected: boolean
  discovered_at: string
  is_processed: boolean
}

function ConfigureChatbotPageContent() {
  const [businessId, setBusinessId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [website, setWebsite] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [urls, setUrls] = useState([''])
  const [documents, setDocuments] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // URL mapping state
  const [discoveredPages, setDiscoveredPages] = useState<DiscoveredPage[]>([])
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([])
  const [mappingLoading, setMappingLoading] = useState(false)
  const [mappingComplete, setMappingComplete] = useState(false)
  const [discoveryInfo, setDiscoveryInfo] = useState<{
    sitemapFound: boolean
    sitemapUrls: number
    linksDiscovered: number
    filteringStats?: {
      totalSitemapUrls: number
      acceptedSitemapUrls: number
      filteredSitemapUrls: number
    }
  } | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const businessIdParam = searchParams.get('businessId')
    if (businessIdParam) {
      setBusinessId(businessIdParam)
      // Fetch business details and existing pages
      fetchBusinessDetails(businessIdParam)
      fetchExistingPages(businessIdParam)
    } else {
      router.push('/business')
    }
  }, [searchParams, router])

  const fetchBusinessDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/business/${id}`)
      const data = await response.json()

      if (response.ok) {
        setBusinessName(data.business_name || '')
        setWebsite(data.url || '')
      }
    } catch (err) {
      console.error('Failed to fetch business details:', err)
    }
  }

  const fetchExistingPages = async (id: string) => {
    try {
      const response = await fetch(`/api/business/${id}/map`)
      const data = await response.json()

      if (response.ok && data.pages) {
        setDiscoveredPages(data.pages)
        setSelectedPageIds(data.pages.filter((p: DiscoveredPage) => p.is_selected).map((p: DiscoveredPage) => p.id))
        setMappingComplete(data.pages.length > 0)
        setDiscoveryInfo(data.discoveryInfo || null)
      }
    } catch (err) {
      console.error('Failed to fetch existing pages:', err)
    }
  }

  const mapWebsiteUrls = async () => {
    if (!businessId) return

    setMappingLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/business/${businessId}/map`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to map URLs')
      }

      setDiscoveredPages(data.pages || [])
      setSelectedPageIds([]) // Start with none selected
      setMappingComplete(true)
      setDiscoveryInfo(data.discoveryInfo || null)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setMappingLoading(false)
    }
  }

  const togglePageSelection = async (pageId: string) => {
    const newSelectedIds = selectedPageIds.includes(pageId)
      ? selectedPageIds.filter(id => id !== pageId)
      : [...selectedPageIds, pageId]

    setSelectedPageIds(newSelectedIds)
    await savePageSelectionsToDatabase(newSelectedIds)
  }

  const selectAllPages = async () => {
    const newSelectedIds = discoveredPages.map(p => p.id)
    setSelectedPageIds(newSelectedIds)
    await savePageSelectionsToDatabase(newSelectedIds)
  }

  const selectNonePages = async () => {
    setSelectedPageIds([])
    await savePageSelectionsToDatabase([])
  }

  const selectCommonPages = async () => {
    // Select pages that are likely important (homepage, about, contact, etc.)
    const commonPaths = ['/', '/about', '/contact', '/services', '/products', '/home']
    const commonPageIds = discoveredPages
      .filter(page => {
        const path = new URL(page.url).pathname.toLowerCase()
        return commonPaths.some(common => path === common || path.includes(common))
      })
      .map(p => p.id)

    setSelectedPageIds(commonPageIds)
    await savePageSelectionsToDatabase(commonPageIds)
  }

  const savePageSelectionsToDatabase = async (pageIds: string[]) => {
    if (!businessId) {
      console.warn('No business ID available for saving selections')
      return
    }

    try {
      console.log('Saving page selections to database:', { businessId, pageIds })

      const response = await fetch(`/api/business/${businessId}/map`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ selectedPageIds: pageIds })
      })

      if (!response.ok) {
        const data = await response.json()
        console.error('Failed to save selections to database:', data)
        throw new Error(data.error || 'Failed to save selections')
      }

      const result = await response.json()
      console.log('Successfully saved selections:', result)

      // Update local state
      setDiscoveredPages(prev => prev.map(page => ({
        ...page,
        is_selected: pageIds.includes(page.id)
      })))

    } catch (err: any) {
      console.error('Error saving page selections:', err)
      setError(`Failed to auto-save selections: ${err.message}`)
    }
  }

  const addUrlField = () => {
    setUrls([...urls, ''])
  }

  const removeUrlField = (index: number) => {
    setUrls(urls.filter((_, i) => i !== index))
  }

  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls]
    newUrls[index] = value
    setUrls(newUrls)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocuments(Array.from(e.target.files))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    // Check if there's any content to work with
    const hasAdditionalUrls = urls.some(url => url.trim())
    const hasDocuments = documents.length > 0
    const hasSelectedPages = selectedPageIds.length > 0

    // Allow configuration if:
    // 1. Pages are selected, OR
    // 2. Additional URLs provided, OR
    // 3. Documents uploaded, OR
    // 4. Business might have existing content (let API decide)

    // Only show error if clearly no content will be available
    if (!hasSelectedPages && !hasAdditionalUrls && !hasDocuments && !mappingComplete) {
      setError('Please provide content for your chatbot by either:\n• Discovering and selecting website pages\n• Adding additional URLs\n• Uploading documents')
      setLoading(false)
      return
    }

    // Selections are already auto-saved to database, no manual save needed

    try {
      const formData = new FormData()

      // Add the primary website URL first
      formData.append('url', website)
      formData.append('businessId', businessId)
      formData.append('customPrompt', customPrompt)

      // Add additional URLs
      urls.filter(url => url.trim()).forEach(url => {
        formData.append('additionalUrls', url.trim())
      })

      // Add documents
      documents.forEach(doc => {
        formData.append('documents', doc)
      })

      const response = await fetch('/api/crawl', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to configure chatbot')
      }

      setSuccess(`✅ ${result.message}`)

      // Redirect to chat page after success
      setTimeout(() => {
        router.push(`/chat?businessId=${businessId}`)
      }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!businessId) {
    return <div>Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Configure Your Chatbot</h1>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">
            <span className="font-medium">Business:</span> {businessName}
          </p>
          <p className="text-green-800">
            <span className="font-medium">Website:</span> {website}
          </p>
        </div>
      </div>

      {/* URL Mapping Section */}
      <div className="bg-white p-8 rounded-lg shadow-sm border mb-8">
        <h2 className="text-2xl font-bold mb-4">Website URL Mapping</h2>
        <p className="text-gray-600 mb-6">
          Discover and select which pages from your website you want to include in your chatbot's knowledge base.
        </p>

        {!mappingComplete ? (
          <div className="text-center">
            <button
              type="button"
              onClick={mapWebsiteUrls}
              disabled={mappingLoading || !website}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {mappingLoading ? 'Discovering URLs...' : 'Discover Website URLs'}
            </button>
            {!website && (
              <p className="text-sm text-gray-500 mt-2">Website URL is required to discover pages</p>
            )}
          </div>
        ) : (
          <div>
            {/* Discovery Information */}
            {discoveryInfo && (
              <div className="mb-4 p-3 bg-gray-50 border rounded-lg">
                <div className="text-sm text-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">Discovery Results:</span>
                    <span>{discoveredPages.length} pages found</span>
                  </div>
                  <div className="space-y-1">
                    {discoveryInfo.sitemapFound ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-green-700">
                          <span>✓</span>
                          <span>Sitemap.xml found ({discoveryInfo.sitemapUrls} URLs)</span>
                        </div>
                        {discoveryInfo.filteringStats && discoveryInfo.filteringStats.filteredSitemapUrls > 0 && (
                          <div className="text-xs text-gray-600 ml-4">
                            • {discoveryInfo.filteringStats.acceptedSitemapUrls} URLs accepted, {discoveryInfo.filteringStats.filteredSitemapUrls} filtered out
                            {discoveryInfo.filteringStats.filteredSitemapUrls > discoveredPages.length && (
                              <span className="text-amber-600"> (consider checking console for filtering details)</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-700">
                        <span>⚠️</span>
                        <span>No sitemap.xml found - relying on link discovery ({discoveryInfo.linksDiscovered} links found)</span>
                      </div>
                    )}
                  </div>
                  {!discoveryInfo.sitemapFound && discoveredPages.length <= 1 && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
                      <strong>💡 Tip:</strong> Since no sitemap was found and few pages were discovered,
                      consider adding specific URLs manually in the "Additional URLs" section below.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info about re-crawling */}
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Re-crawling:</strong> You can select both new and already processed pages.
                Selected pages will be crawled fresh, replacing any existing content.
              </p>
            </div>

            {/* Selection Controls */}
            <div className="flex gap-4 mb-4">
              <button
                type="button"
                onClick={selectAllPages}
                className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
              >
                Select All ({discoveredPages.length})
              </button>
              <button
                type="button"
                onClick={selectCommonPages}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                Select Common Pages
              </button>
              <button
                type="button"
                onClick={selectNonePages}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Select None
              </button>
              <div className="ml-auto px-4 py-2 bg-gray-50 text-gray-700 rounded-lg">
                {selectedPageIds.length} selected (auto-saved)
              </div>
            </div>

            {/* URL List */}
            <div className="max-h-96 overflow-y-auto border rounded-lg">
              {discoveredPages.map((page) => (
                <div
                  key={page.id}
                  className={`flex items-center p-3 border-b last:border-b-0 hover:bg-gray-50 ${
                    selectedPageIds.includes(page.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPageIds.includes(page.id)}
                    onChange={() => togglePageSelection(page.id)}
                    className="mr-3 h-4 w-4 text-blue-600 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {page.title}
                      </span>
                      {page.is_processed ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Processed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{page.url}</p>
                  </div>
                </div>
              ))}
            </div>

            {discoveredPages.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No pages discovered. Try clicking "Discover Website URLs" again.</p>
              </div>
            )}

            <div className="mt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={mapWebsiteUrls}
                disabled={mappingLoading}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                {mappingLoading ? 'Rediscovering...' : 'Rediscover URLs'}
              </button>
              <p className="text-sm text-gray-600">
                {selectedPageIds.length} of {discoveredPages.length} pages selected
              </p>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-lg shadow-sm border">
        <div>
          <label htmlFor="customPrompt" className="block text-sm font-medium text-gray-700 mb-2">
            Custom System Prompt (Optional)
          </label>
          <textarea
            id="customPrompt"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="You are a helpful assistant for [Business Name]. Always be friendly and professional..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={4}
          />
          <p className="text-sm text-gray-500 mt-1">
            Customize how your chatbot behaves and responds to users
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional URLs to Crawl {discoveryInfo && !discoveryInfo.sitemapFound && discoveredPages.length <= 1 ? '(Recommended)' : '(Optional)'}
          </label>
          {discoveryInfo && !discoveryInfo.sitemapFound && discoveredPages.length <= 1 ? (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Limited page discovery:</strong> Since your website doesn't have a sitemap and only {discoveredPages.length} page(s) were found through link discovery,
                manually adding important URLs like /about, /services, /contact, /hours is recommended for comprehensive coverage.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-4">
              Add specific pages or sections you want to include beyond the main website
            </p>
          )}

          {urls.map((url, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="url"
                value={url}
                onChange={(e) => updateUrl(index, e.target.value)}
                placeholder="https://example.com/specific-page"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {urls.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeUrlField(index)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addUrlField}
            className="mt-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
          >
            + Add Another URL
          </button>
        </div>

        <div>
          <label htmlFor="documents" className="block text-sm font-medium text-gray-700 mb-2">
            Upload Documents (Optional)
          </label>
          <input
            id="documents"
            type="file"
            multiple
            onChange={handleFileChange}
            accept=".txt,.pdf,.doc,.docx,.md"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Upload additional documents (PDF, DOC, TXT, MD files)
          </p>
          {documents.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-700">Selected files:</p>
              <ul className="text-sm text-gray-600">
                {documents.map((doc, index) => (
                  <li key={index}>• {doc.name} ({(doc.size / 1024).toFixed(1)} KB)</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Configuration Summary */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Configuration Summary</h4>
          <div className="text-sm text-blue-700 space-y-1">
            {mappingComplete ? (
              selectedPageIds.length > 0 ? (
                <div>
                  <p>• <strong>{selectedPageIds.length}</strong> selected pages will be crawled fresh</p>
                  {selectedPageIds.length > 0 && discoveredPages.some(p => selectedPageIds.includes(p.id) && p.is_processed) && (
                    <p className="text-xs text-blue-600 ml-4">
                      (includes previously processed pages that will be re-crawled)
                    </p>
                  )}
                </div>
              ) : (
                <p>• Will use <strong>existing content</strong> from previous crawls (if available)</p>
              )
            ) : (
              <p>• Will use <strong>existing content</strong> from database (no URL mapping performed yet)</p>
            )}
            {urls.filter(url => url.trim()).length > 0 && (
              <p>• <strong>{urls.filter(url => url.trim()).length}</strong> additional URLs will be crawled</p>
            )}
            {documents.length > 0 && (
              <p>• <strong>{documents.length}</strong> documents will be processed</p>
            )}
            {!mappingComplete && urls.filter(url => url.trim()).length === 0 && documents.length === 0 && (
              <p className="text-amber-700">ℹ️ No new content - will attempt to use existing content from database</p>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-600 whitespace-pre-line">{error}</div>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600">{success}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Configuring Chatbot...' : 'Configure Chatbot'}
        </button>
      </form>

      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• We'll crawl only your selected pages and additional URLs (no random discovery)</li>
          <li>• Your documents will be processed and indexed</li>
          <li>• Content will be chunked and embedded for optimal search</li>
          <li>• Your chatbot will be ready with precisely the content you chose</li>
        </ul>
      </div>
    </div>
  )
}

export default function ConfigureChatbotPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfigureChatbotPageContent />
    </Suspense>
  )
}