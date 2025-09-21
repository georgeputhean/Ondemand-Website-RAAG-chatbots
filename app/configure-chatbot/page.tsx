'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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

  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const businessIdParam = searchParams.get('businessId')
    if (businessIdParam) {
      setBusinessId(businessIdParam)
      // Fetch business details
      fetchBusinessDetails(businessIdParam)
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
            Additional URLs to Crawl (Optional)
          </label>
          <p className="text-sm text-gray-500 mb-4">
            Add specific pages or sections you want to include beyond the main website
          </p>

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

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
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
          <li>• We'll crawl your website and any additional URLs</li>
          <li>• Your documents will be processed and indexed</li>
          <li>• Content will be chunked and embedded for optimal search</li>
          <li>• Your chatbot will be ready to answer questions about your content</li>
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