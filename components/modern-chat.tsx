'use client'

import { useChat } from '@ai-sdk/react'
import { useState, useRef, useEffect } from 'react'
import { Send, StopCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

interface ModernChatProps {
  chatId?: string
  className?: string
}

export function ModernChat({ chatId, className }: ModernChatProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, isLoading, append, stop } = useChat({
    api: '/api/chat',
    id: chatId,
  })

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    await append({
      role: 'user',
      content: userMessage,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <div className={cn('flex flex-col h-full max-w-4xl mx-auto', className)}>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-4">
              <div className="text-2xl font-semibold text-gray-900">Welcome to Trovix.ai</div>
              <p className="text-gray-600 max-w-md">
                Start a conversation with your AI assistant. Ask questions about your business, get help with tasks, or just chat!
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput("What can you help me with?")}
                >
                  What can you help me with?
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput("Tell me about my business data")}
                >
                  Tell me about my business data
                </Button>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                'flex w-full',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <Card
                className={cn(
                  'max-w-[80%] break-words',
                  message.role === 'user'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-gray-200'
                )}
              >
                <CardContent className="p-4">
                  {message.role === 'user' ? (
                    <div className="text-sm">{message.content}</div>
                  ) : (
                    <div className="prose prose-sm max-w-none text-gray-900">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <Card className="max-w-[80%] bg-white border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-sm text-gray-500">AI is thinking...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="min-h-[60px] max-h-[120px] pr-12 resize-none"
              disabled={isLoading}
            />
          </div>

          {isLoading ? (
            <Button
              type="button"
              onClick={stop}
              size="icon"
              variant="outline"
              className="h-[60px] w-[60px]"
            >
              <StopCircle className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-[60px] w-[60px]"
            >
              <Send className="h-5 w-5" />
            </Button>
          )}
        </form>

        <p className="text-xs text-gray-500 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}