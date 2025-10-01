'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface VoiceIndicatorProps {
  isListening?: boolean
  isSpeaking?: boolean
  transcription?: string
  className?: string
}

export function VoiceIndicator({
  isListening = false,
  isSpeaking = false,
  transcription = '',
  className
}: VoiceIndicatorProps) {
  const [audioLevel, setAudioLevel] = useState(0)

  // Simulate audio level animation
  useEffect(() => {
    if (isListening || isSpeaking) {
      const interval = setInterval(() => {
        setAudioLevel(Math.random() * 100)
      }, 100)
      return () => clearInterval(interval)
    } else {
      setAudioLevel(0)
    }
  }, [isListening, isSpeaking])

  return (
    <div className={cn('flex flex-col space-y-2', className)}>
      {/* Audio Waveform Visualization */}
      {(isListening || isSpeaking) && (
        <div className="flex items-center justify-center space-x-1 h-8">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-1 bg-blue-500 rounded-full transition-all duration-100',
                isListening && 'bg-green-500',
                isSpeaking && 'bg-blue-500'
              )}
              style={{
                height: `${Math.max(4, (audioLevel + i * 10) % 32)}px`,
                animationDelay: `${i * 100}ms`
              }}
            />
          ))}
        </div>
      )}

      {/* Status Text */}
      <div className="text-center">
        {isListening && (
          <div className="flex items-center justify-center space-x-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-600 font-medium">Listening...</span>
          </div>
        )}

        {isSpeaking && (
          <div className="flex items-center justify-center space-x-2">
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-xs text-blue-600 font-medium">Speaking...</span>
          </div>
        )}

        {!isListening && !isSpeaking && (
          <span className="text-xs text-gray-500">Voice ready</span>
        )}
      </div>

      {/* Real-time Transcription */}
      {transcription && (
        <div className="bg-gray-50 border rounded-lg p-3 mt-2">
          <div className="flex items-start space-x-2">
            <div className="h-2 w-2 bg-green-500 rounded-full mt-1.5 animate-pulse" />
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">You're saying:</div>
              <div className="text-sm text-gray-900">
                {transcription}
                <span className="animate-pulse">|</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VoiceIndicator