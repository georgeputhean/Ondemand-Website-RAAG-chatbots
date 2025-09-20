"use client"
import React, { useState } from 'react'

export default function HomePage() {
  const [url, setUrl] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [documents, setDocuments] = useState<FileList | null>(null)
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState("")

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      setMessage('Starting crawl...')

      // Create FormData to handle file uploads
      const formData = new FormData()
      formData.append('url', url)
      if (businessName) formData.append('businessName', businessName)
      if (customPrompt) formData.append('customPrompt', customPrompt)

      // Add documents if any
      if (documents) {
        for (let i = 0; i < documents.length; i++) {
          formData.append('documents', documents[i])
        }
      }

      const res = await fetch('/api/crawl', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start crawl')
      
      if (data.message) {
        setMessage(data.message)
        if (data.stats) {
          setMessage(`${data.message} (${data.stats.pagesCrawled} pages, ${data.stats.chunksCreated} chunks)`)
        }
      } else {
        setMessage('Crawl completed successfully!')
      }
      if (data.businessId) {
        setMessage(prev => (prev ? `${prev} | business_id=${data.businessId}` : `business_id=${data.businessId}`))
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-medium mb-2">Create your website chatbot</h2>
        <p className="text-sm text-gray-600 mb-4">Enter your business website URL. We'll crawl public pages, index them, and build a chatbot trained on your content.</p>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Business Name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="flex-1 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="url"
            required
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Upload Documents (Optional)</label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => setDocuments(e.target.files)}
              className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">Supported formats: PDF, DOC, DOCX, TXT</p>
          </div>
          <textarea
            placeholder="Optional: Add a custom system prompt to guide the bot (tone, policies, etc.)"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="w-full min-h-[90px] border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button disabled={loading} className="self-start px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50">
            {loading ? 'Processing…' : 'Create Bot'}
          </button>
        </form>
        {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}
        {jobId && (
          <p className="mt-2 text-sm">Job ID: <code className="px-1 py-0.5 bg-gray-100 rounded">{jobId}</code></p>
        )}
      </div>
      <div className="mt-8">
        <a className="text-blue-600 hover:underline" href="/chat">Go to Chat</a>
      </div>
    </main>
  )
}


