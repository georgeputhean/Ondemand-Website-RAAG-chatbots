"use client"
import React, { useState } from 'react'

type Message = { role: 'user' | 'assistant'; content: string; sources?: { title: string; url: string }[] }

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  const copyEmbedCode = () => {
    const params = new URLSearchParams(window.location.search)
    const businessId = params.get('businessId') || params.get('business_id')
    const embedCode = `<iframe
  src="${window.location.origin}/chat${businessId ? `?businessId=${businessId}` : ''}"
  width="400"
  height="600"
  frameborder="0"
  style="border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
</iframe>`

    navigator.clipboard.writeText(embedCode).then(() => {
      alert('Embed code copied to clipboard!')
    }).catch(() => {
      alert('Failed to copy embed code')
    })
  }

  const send = async () => {
    if (!input.trim()) return
    const newMessages = [...messages, { role: 'user', content: input } as Message]
    setMessages(newMessages)
    setInput("")
    setLoading(true)
    try {
      const params = new URLSearchParams(window.location.search)
      const businessId = params.get('businessId') || params.get('business_id')
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          business_id: businessId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chat failed')
      setMessages([...newMessages, { role: 'assistant', content: data.answer, sources: data.sources }])
    } catch (e: any) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Test your chatbot</h2>
          <button
            onClick={copyEmbedCode}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Copy Embed Code
          </button>
        </div>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto border rounded p-3">
          {messages.length === 0 && <p className="text-sm text-gray-500">Ask something about your website content.</p>}
          {messages.map((m, idx) => (
            <div key={idx} className="">
              <div className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <div className={m.role === 'user' ? 'inline-block bg-blue-600 text-white px-3 py-2 rounded-lg' : 'inline-block bg-gray-100 px-3 py-2 rounded-lg'}>
                  {m.content}
                </div>
              </div>
              {m.role === 'assistant' && m.sources && (
                <div className="text-xs text-gray-600 mt-1">
                  Sources: {m.sources.map((s, i) => (
                    <a key={i} className="text-blue-600 hover:underline mr-2" href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            placeholder="Type your message..."
            className="flex-1 border rounded px-3 py-2"
          />
          <button onClick={send} disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">Send</button>
        </div>
      </div>
    </main>
  )
}


