'use client'

import { useState, useRef, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, X, MessageCircle, Bot, User, Minimize2 } from 'lucide-react'
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
    <div className={cn('flex gap-3 p-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className={cn(
        'max-w-[80%] break-words rounded-xl px-3 py-2 text-sm',
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-900'
      )}>
        {isUser ? (
          <p className="mb-0">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {sources && sources.length > 0 && (
          <div className="mt-2 pt-1 border-t border-gray-200 space-y-1">
            <p className="text-xs font-medium text-gray-500">Sources:</p>
            <div className="flex flex-wrap gap-1">
              {sources.map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded bg-gray-50 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  {source.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-gray-500 text-white shadow-sm">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}

function ChatWidget() {
  const searchParams = useSearchParams()
  const businessId = searchParams.get('businessId') || searchParams.get('business_id')
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sources, setSources] = useState<Record<string, Source[]>>({})
  const [businessName, setBusinessName] = useState<string>('')
  const [isMounted, setIsMounted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Ensure component only renders on client-side
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Fetch business name when component mounts (client-side only)
  useEffect(() => {
    if (businessId && isMounted) {
      fetch(`/api/business/${businessId}`)
        .then(res => res.json())
        .then(data => {
          if (data?.business_name) {
            setBusinessName(data.business_name)
          }
        })
        .catch(err => console.error('Failed to fetch business name:', err))
    }
  }, [businessId, isMounted])

  useEffect(() => {
    if (messagesEndRef.current && isMounted) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isMounted])

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
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('0:')) {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  // Don't render until mounted on client-side
  if (!isMounted) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="h-16 w-16 rounded-full bg-gray-200 animate-pulse"></div>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="icon"
          className="h-16 w-16 rounded-full bg-blue-600 hover:bg-blue-700 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
        >
          <MessageCircle className="h-8 w-8" />
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-blue-600 text-white px-4 py-3">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{businessName || 'Support'}</h3>
            <p className="text-xs text-blue-100">We're here to help</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 text-white hover:bg-blue-500"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 text-white hover:bg-blue-500"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
              <Bot className="h-6 w-6 text-blue-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">Hi there! 👋</h4>
            <p className="text-sm text-gray-600 mb-3">
              How can we help you today?
            </p>
            <div className="space-y-2 w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("What services do you offer?")}
                className="w-full text-xs h-8"
              >
                What services do you offer?
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("How can I contact support?")}
                className="w-full text-xs h-8"
              >
                How can I contact support?
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id || index}
                message={message}
                sources={message.role === 'assistant' ? sources[message.id] : undefined}
              />
            ))}
            {isLoading && (
              <div className="flex gap-3 p-3">
                <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="max-w-[80%] break-words rounded-xl px-3 py-2 bg-gray-100">
                  <div className="flex items-center space-x-1">
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]"></div>
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]"></div>
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[36px] max-h-20 resize-none text-sm py-2 px-3"
            rows={1}
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="h-9 w-9 bg-blue-600 hover:bg-blue-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

// Create a client-only widget component to prevent SSR hydration issues
const ClientOnlyWidget = dynamic(() => Promise.resolve(ChatWidget), {
  ssr: false,
  loading: () => (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="h-16 w-16 rounded-full bg-gray-200 animate-pulse"></div>
    </div>
  )
})

function ChatWidgetContent() {
  return <ClientOnlyWidget />
}

export default function ChatWidgetPage() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: 999999
    }}>
      <Suspense fallback={
        <div className="fixed bottom-6 right-6" style={{ pointerEvents: 'auto' }}>
          <div className="h-16 w-16 rounded-full bg-gray-200 animate-pulse"></div>
        </div>
      }>
        <div style={{ pointerEvents: 'auto' }}>
          <ChatWidgetContent />
        </div>
      </Suspense>
    </div>
  )
}