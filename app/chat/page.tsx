'use client'

import { useState, useRef, Suspense } from 'react'
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
    <div className={cn('flex gap-3 p-4', isUser ? 'bg-muted/50' : 'bg-background')}>
      <div className={cn(
        'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow',
        isUser ? 'bg-background' : 'bg-primary text-primary-foreground'
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="prose prose-sm max-w-none break-words dark:prose-invert">
          {isUser ? (
            <p className="mb-2 last:mb-0">{message.content}</p>
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>
        {sources && sources.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Sources:</p>
            <div className="flex flex-wrap gap-2">
              {sources.map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs hover:bg-muted/80"
                >
                  <ExternalLink className="h-3 w-3" />
                  {source.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
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
    <div className="border-t bg-background px-4 py-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          ref={inputRef}
          placeholder="Ask a question about the website content..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-[40px] resize-none rounded-lg"
          rows={1}
        />
        <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
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

  return (
    <div className="flex h-screen max-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Ask questions about the website content
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={copyEmbedCode}>
          <Copy className="mr-2 h-4 w-4" />
          Embed Code
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-medium">Start a conversation</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Ask me anything about the website content and I'll help you find answers.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id || index}
                message={message}
                sources={message.role === 'assistant' ? sources[message.id] : undefined}
              />
            ))}
            {isLoading && (
              <div className="flex gap-3 p-4">
                <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.3s]"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.15s]"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500"></div>
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