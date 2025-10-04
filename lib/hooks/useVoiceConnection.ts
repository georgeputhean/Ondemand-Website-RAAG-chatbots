'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Voice server URL from environment variable
const VOICE_SERVER_URL = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || 'http://localhost:7860'

// Speech Recognition interface declaration
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition
  new(): SpeechRecognition
}

interface VoiceConnectionOptions {
  businessId?: string
  onTranscription?: (text: string) => void
  onResponse?: (text: string) => void
  onError?: (error: string) => void
}

interface VoiceStatus {
  isVoiceMode: boolean
  isConnected: boolean
  isConnecting: boolean
  isMuted: boolean
  isListening: boolean
  isSpeaking: boolean
  error?: string
}

export function useVoiceConnection(options: VoiceConnectionOptions = {}) {
  const [status, setStatus] = useState<VoiceStatus>({
    isVoiceMode: false,
    isConnected: false,
    isConnecting: false,
    isMuted: false,
    isListening: false,
    isSpeaking: false
  })

  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Helper function to set error with auto-clear timeout
  const setErrorWithTimeout = useCallback((error: string) => {
    // Clear any existing timeout
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current)
    }

    setStatus(prev => ({ ...prev, error }))

    // Clear error after 5 seconds
    errorTimeoutRef.current = setTimeout(() => {
      setStatus(prev => ({ ...prev, error: undefined }))
    }, 5000)
  }, [])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null)
  const synthesisRef = useRef<SpeechSynthesis | null>(null)

  // Process speech input and get response
  const processSpeechInput = useCallback(async (transcript: string) => {
    try {
      setStatus(prev => ({ ...prev, isSpeaking: true }))

      // Send to chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: transcript }],
          business_id: options.businessId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get chat response')
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''

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
                  fullResponse += parsed
                }
              } catch (err) {
                // Ignore parsing errors
              }
            }
          }
        }
      }

      if (fullResponse) {
        options.onResponse?.(fullResponse)
        speak(fullResponse)
      }

    } catch (error) {
      console.error('Error processing speech input:', error)
      const errorMsg = 'Sorry, I had trouble processing that. Could you try again?'
      speak(errorMsg)
      options.onResponse?.(errorMsg)
    } finally {
      setStatus(prev => ({ ...prev, isSpeaking: false }))
    }
  }, [options.businessId, options.onResponse])

  // Text-to-speech function
  const speak = useCallback((text: string) => {
    if (!synthesisRef.current) return

    // Cancel any ongoing speech
    synthesisRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onstart = () => {
      setStatus(prev => ({ ...prev, isSpeaking: true }))
    }

    utterance.onend = () => {
      setStatus(prev => ({ ...prev, isSpeaking: false }))
    }

    utterance.onerror = (error) => {
      // Only log non-interrupted errors (interrupted is expected when canceling previous speech)
      if (error.error !== 'interrupted' && error.error !== 'canceled') {
        console.error('Speech synthesis error:', error)
        setErrorWithTimeout('Speech synthesis error')
      }
      setStatus(prev => ({ ...prev, isSpeaking: false }))
    }

    synthesisRef.current.speak(utterance)
  }, [setErrorWithTimeout])

  // Start voice mode
  const startVoiceMode = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, isConnecting: true, error: undefined }))

      // Check if voice server is healthy
      try {
        const healthResponse = await fetch(`${VOICE_SERVER_URL}/health`)
        if (!healthResponse.ok) {
          throw new Error('Voice server not responding')
        }
        const healthData = await healthResponse.json()
        if (!healthData.ready) {
          throw new Error('Voice server not ready')
        }
      } catch (error) {
        throw new Error('Voice functionality is currently unavailable. Please try again later.')
      }

      // Initialize speech recognition
      const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognitionConstructor) {
        throw new Error('Speech recognition not supported in this browser')
      }

      const recognition = new SpeechRecognitionConstructor()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      speechRecognitionRef.current = recognition

      // Initialize speech synthesis
      if (!window.speechSynthesis) {
        throw new Error('Speech synthesis not supported in this browser')
      }
      synthesisRef.current = window.speechSynthesis

      // Handle speech recognition results
      recognition.onresult = (event) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0].transcript

          if (result.isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        if (finalTranscript) {
          setStatus(prev => ({ ...prev, isListening: false }))
          options.onTranscription?.(finalTranscript)
          processSpeechInput(finalTranscript)
        } else if (interimTranscript) {
          setStatus(prev => ({ ...prev, isListening: true }))
        }
      }

      recognition.onstart = () => {
        setStatus(prev => ({ ...prev, isListening: true }))
      }

      recognition.onend = () => {
        setStatus(prev => ({ ...prev, isListening: false }))
        // Restart recognition if voice mode is still active
        if (speechRecognitionRef.current && status.isVoiceMode) {
          setTimeout(() => {
            try {
              speechRecognitionRef.current?.start()
            } catch (error) {
              console.warn('Failed to restart speech recognition:', error)
            }
          }, 1000)
        }
      }

      recognition.onerror = (event) => {
        // Only log significant errors, not common permission/abort issues
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          console.error('Speech recognition error:', event.error)
        }

        let userFriendlyError = 'Speech recognition error'
        if (event.error === 'not-allowed') {
          userFriendlyError = 'Microphone access denied'
        } else if (event.error === 'network') {
          userFriendlyError = 'Network error'
        } else if (event.error === 'no-speech') {
          // Don't show error for no speech detected
          return
        }

        setErrorWithTimeout(userFriendlyError)
      }

      // Start speech recognition
      recognition.start()

      setStatus(prev => ({
        ...prev,
        isVoiceMode: true,
        isConnecting: false,
        isConnected: true
      }))

      // Notify that voice mode is active
      speak('Voice mode activated. You can now speak your questions.')
      options.onTranscription?.('Voice mode activated. You can now speak your questions.')

    } catch (error) {
      console.error('Voice connection error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect'

      setStatus(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: false
      }))
      setErrorWithTimeout(errorMessage)

      options.onError?.(errorMessage)
    }
  }, [options.businessId, options.onError, options.onTranscription, setErrorWithTimeout])

  // Stop voice mode
  const stopVoiceMode = useCallback(async () => {
    try {
      // Stop speech recognition
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop()
        speechRecognitionRef.current = null
      }

      // Stop any ongoing speech synthesis
      if (synthesisRef.current) {
        synthesisRef.current.cancel()
      }

      setStatus({
        isVoiceMode: false,
        isConnected: false,
        isConnecting: false,
        isMuted: false,
        isListening: false,
        isSpeaking: false
      })

    } catch (error) {
      console.error('Error stopping voice mode:', error)
    }
  }, [])

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (speechRecognitionRef.current) {
      const newMutedState = !status.isMuted
      if (newMutedState) {
        // Mute: stop recognition
        speechRecognitionRef.current.stop()
      } else {
        // Unmute: restart recognition
        try {
          speechRecognitionRef.current.start()
        } catch (error) {
          console.warn('Failed to restart speech recognition:', error)
        }
      }
      setStatus(prev => ({ ...prev, isMuted: newMutedState }))
    }
  }, [status.isMuted])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clear any pending error timeouts
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
      }
      stopVoiceMode()
    }
  }, [stopVoiceMode])

  return {
    status,
    startVoiceMode,
    stopVoiceMode,
    toggleMute
  }
}