'use client'

import { useState, useRef, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Copy, ExternalLink, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

type Source = {
  title: string
  url: string
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function ChatMessage({ message, sources }: { message: Message; sources?: Source[] }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-4 p-6 max-w-4xl mx-auto', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
          <Bot className="h-5 w-5" />
        </div>
      )}
      <div className={cn(
        'max-w-[80%] break-words rounded-2xl px-4 py-3 shadow-sm',
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-white border border-gray-200'
      )}>
        <div className={cn(
          'prose prose-sm max-w-none',
          isUser ? 'prose-invert' : 'prose-gray'
        )}>
          {isUser ? (
            <p className="mb-0 text-sm">{message.content}</p>
          ) : (
            <div className="text-sm text-gray-900">
              <ReactMarkdown
                components={{
                  // Prevent rendering of problematic HTML tags
                  html: () => null,
                  head: () => null,
                  body: () => null,
                  script: () => null,
                  style: () => null,
                  // Ensure paragraphs don't have margin issues
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {sources && sources.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-100 space-y-1">
            <p className="text-xs font-medium text-gray-500">Sources:</p>
            <div className="flex flex-wrap gap-2">
              {sources.map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  {source.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full bg-gray-600 text-white shadow-md">
          <User className="h-5 w-5" />
        </div>
      )}
    </div>
  )
}

function ChatInput({ input, setInput, handleSubmit, isLoading }: {
  input: string
  setInput: (value: string) => void
  handleSubmit: (e: any) => void
  isLoading: boolean
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white px-6 py-4">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={inputRef}
              placeholder="Ask a question about the website content..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              className="min-h-[60px] max-h-[120px] resize-none rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 pr-4 py-4 shadow-sm"
              rows={1}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="h-12 w-12 rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-md"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}

function ChatPageContent() {
  const searchParams = useSearchParams()
  const businessId = searchParams.get('businessId') || searchParams.get('business_id')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sources, setSources] = useState<Record<string, Source[]>>({})
  const [businessName, setBusinessName] = useState<string>('')

  // Fetch business name when component mounts
  useEffect(() => {
    if (businessId) {
      fetch(`/api/business/${businessId}`)
        .then(res => res.json())
        .then(data => {
          if (data?.business_name) {
            setBusinessName(data.business_name)
          }
        })
        .catch(err => console.error('Failed to fetch business name:', err))
    }
  }, [businessId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          business_id: businessId
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      // Handle sources from headers
      const sourcesHeader = response.headers.get('X-Sources')
      let messageSources: Source[] = []
      if (sourcesHeader) {
        try {
          const decodedSources = atob(sourcesHeader)
          messageSources = JSON.parse(decodedSources)
        } catch (err) {
          console.error('Failed to parse sources:', err)
        }
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: ''
      }

      setMessages(prev => [...prev, assistantMessage])

      if (reader) {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('0:')) {
              // Parse AI SDK streaming format
              try {
                const jsonStr = line.slice(2)
                const parsed = JSON.parse(jsonStr)
                if (typeof parsed === 'string') {
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMessage.id
                        ? { ...msg, content: msg.content + parsed }
                        : msg
                    )
                  )
                }
              } catch (err) {
                // Ignore parsing errors
              }
            }
          }
        }
      }

      // Store sources for this message
      if (messageSources.length > 0) {
        setSources(prev => ({
          ...prev,
          [assistantMessage.id]: messageSources
        }))
      }

    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const copyEmbedCode = () => {
    const embedCode = `<!-- Trovix.ai Chat Widget -->
<iframe
  src="${window.location.origin}/widget${businessId ? `?businessId=${businessId}` : ''}"
  width="100%"
  height="100%"
  frameborder="0"
  style="position: fixed; bottom: 0; right: 0; width: 100vw; height: 100vh; z-index: 999999; pointer-events: none; border: none;"
  allow="microphone; camera"
  scrolling="no">
</iframe>

<style>
  body { margin-right: 0 !important; }
  iframe[src*="/widget"] { pointer-events: auto !important; }
</style>`

    navigator.clipboard.writeText(embedCode).then(() => {
      alert('Embed code copied to clipboard! Paste this code just before the closing </body> tag on your website.')
    }).catch(() => {
      alert('Failed to copy embed code')
    })
  }

  return (
    <div className="flex h-screen max-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{businessName || 'Business Assistant'}</h1>
          <p className="text-sm text-gray-600">
            Do you have any questions for us?
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={copyEmbedCode} className="border-gray-300 hover:bg-gray-50">
          <Copy className="mr-2 h-4 w-4" />
          Embed Code
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="mx-auto h-20 w-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <Bot className="h-10 w-10 text-blue-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                Welcome to {businessName || 'our AI Assistant'}
              </h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                How can we help you today? Ask us any questions and we'll provide you with helpful information.
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput("What information can you help me find?")}
                  className="w-full justify-start border-gray-300 hover:bg-gray-50"
                >
                  What information can you help me find?
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput("Tell me about the content on my website")}
                  className="w-full justify-start border-gray-300 hover:bg-gray-50"
                >
                  Tell me about the content on my website
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-6">
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id || index}
                message={message}
                sources={message.role === 'assistant' ? sources[message.id] : undefined}
              />
            ))}
            {isLoading && (
              <div className="flex gap-4 p-6 max-w-4xl mx-auto">
                <div className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="max-w-[80%] break-words rounded-2xl px-4 py-3 bg-white border border-gray-200 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400"></div>
                    </div>
                    <span className="text-sm text-gray-500">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  )
}