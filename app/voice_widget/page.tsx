'use client'

import { useState, useRef, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, AlertCircle, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVoiceConnection } from '@/lib/hooks/useVoiceConnection'

interface VoiceWidgetContentProps {}

function VoiceWidgetContent() {
  const searchParams = useSearchParams()
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [businessName, setBusinessName] = useState<string>('')
  const [isSupported, setIsSupported] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt')

  // Ensure component only renders on client-side and get businessId
  useEffect(() => {
    setIsMounted(true)
    const id = searchParams.get('businessId') || searchParams.get('business_id')
    setBusinessId(id)
  }, [searchParams])

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

  // Check browser support
  useEffect(() => {
    const checkSupport = async () => {
      const hasWebRTC = !!(
        window.RTCPeerConnection ||
        window.webkitRTCPeerConnection ||
        window.mozRTCPeerConnection
      )

      const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      const hasSpeechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

      setIsSupported(hasWebRTC && hasMediaDevices && hasSpeechRecognition)

      // Check microphone permission
      if (hasMediaDevices) {
        try {
          const permissions = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          setPermissionStatus(permissions.state)
        } catch (error) {
          console.warn('Permission API not supported')
        }
      }
    }

    if (isMounted) {
      checkSupport()
    }
  }, [isMounted])

  const { status, startVoiceMode, stopVoiceMode, toggleMute } = useVoiceConnection({
    businessId: businessId || undefined,
    onTranscription: (text) => {
      console.log('Transcription:', text)
    },
    onResponse: (text) => {
      console.log('Response:', text)
    },
    onError: (error) => {
      console.error('Voice connection error:', error)
    }
  })

  const handleVoiceToggle = async () => {
    if (!isSupported) {
      alert('Voice chat is not supported in your browser. Please use Chrome, Firefox, or Safari.')
      return
    }

    if (!status.isVoiceMode && permissionStatus !== 'granted') {
      try {
        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop()) // Stop immediately after permission check
        setPermissionStatus('granted')
      } catch (error) {
        console.error('Microphone permission denied:', error)
        setPermissionStatus('denied')
        alert('Microphone access is required for voice chat. Please allow microphone access and try again.')
        return
      }
    }

    if (status.isVoiceMode) {
      await stopVoiceMode()
    } else {
      await startVoiceMode()
    }
  }

  // Don't render until mounted on client-side and businessId is available
  if (!isMounted || businessId === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="h-48 w-48 rounded-full bg-gray-200 animate-pulse"></div>
      </div>
    )
  }

  // Get button color based on voice status
  const getButtonColor = () => {
    if (status.error) return 'bg-red-500 hover:bg-red-600 border-red-400'
    if (status.isConnecting) return 'bg-orange-500 hover:bg-orange-600 border-orange-400'
    if (status.isVoiceMode && status.isConnected) return 'bg-green-500 hover:bg-green-600 border-green-400'
    if (status.isVoiceMode) return 'bg-blue-500 hover:bg-blue-600 border-blue-400'
    return 'bg-blue-600 hover:bg-blue-700 border-blue-500'
  }

  // Get button icon
  const getButtonIcon = () => {
    if (status.isConnecting) return <Phone className="h-16 w-16 animate-spin" />
    if (status.isVoiceMode) return <Phone className="h-16 w-16" />
    return <PhoneOff className="h-16 w-16" />
  }

  // Get status text
  const getStatusText = () => {
    if (status.error) return status.error
    if (status.isConnecting) return 'Connecting to voice...'
    if (status.isVoiceMode && status.isConnected) return 'Voice mode active - Speak now'
    if (status.isVoiceMode) return 'Voice mode starting...'
    return 'Click to start voice chat'
  }

  // Get listening indicator
  const getListeningIndicator = () => {
    if (status.isListening) {
      return (
        <div className="absolute -inset-4 rounded-full border-4 border-green-400 animate-pulse">
          <div className="absolute -inset-2 rounded-full border-2 border-green-300 animate-ping"></div>
        </div>
      )
    }
    if (status.isSpeaking) {
      return (
        <div className="absolute -inset-4 rounded-full border-4 border-blue-400 animate-pulse">
          <div className="absolute -inset-2 rounded-full border-2 border-blue-300 animate-ping"></div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Voice Assistant
        </h1>
        <p className="text-xl text-gray-600 mb-2">
          {businessName || 'AI Assistant'}
        </p>
        <p className="text-lg text-gray-500">
          Speak naturally and get instant responses
        </p>
      </div>

      {/* Main Voice Button - Approximately 5cm (190px) diameter */}
      <div className="relative mb-8">
        {getListeningIndicator()}

        <Button
          onClick={handleVoiceToggle}
          disabled={status.isConnecting || !isSupported}
          className={cn(
            'h-48 w-48 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95',
            'border-4 text-white font-bold text-lg',
            getButtonColor()
          )}
        >
          {getButtonIcon()}
        </Button>

        {/* Status indicator dot */}
        <div className="absolute -top-2 -right-2">
          <div className={cn(
            'h-6 w-6 rounded-full border-2 border-white',
            status.isConnected ? 'bg-green-500' :
            status.isConnecting ? 'bg-orange-500' :
            status.error ? 'bg-red-500' : 'bg-gray-400'
          )}></div>
        </div>
      </div>

      {/* Status Text */}
      <div className="text-center mb-8 max-w-md">
        <p className={cn(
          'text-lg font-medium',
          status.error ? 'text-red-600' :
          status.isConnected ? 'text-green-600' :
          status.isConnecting ? 'text-orange-600' :
          'text-gray-600'
        )}>
          {getStatusText()}
        </p>

        {status.isListening && (
          <p className="text-sm text-green-600 mt-2 animate-pulse">
            🎤 Listening...
          </p>
        )}

        {status.isSpeaking && (
          <p className="text-sm text-blue-600 mt-2 animate-pulse">
            🔊 Speaking...
          </p>
        )}
      </div>

      {/* Voice Controls (when active) */}
      {status.isVoiceMode && (
        <div className="flex items-center space-x-4 mb-8">
          <Button
            variant="outline"
            size="lg"
            onClick={toggleMute}
            className={cn(
              'h-16 w-16 rounded-full border-2',
              status.isMuted ? 'bg-red-100 border-red-300 text-red-700' : 'border-gray-300'
            )}
          >
            {status.isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={stopVoiceMode}
            className="h-16 w-24 rounded-full border-2 border-red-300 text-red-700 hover:bg-red-50"
          >
            Stop
          </Button>
        </div>
      )}

      {/* Browser Support Info */}
      {!isSupported && (
        <div className="text-center bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md">
          <AlertCircle className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
          <p className="text-sm text-yellow-800">
            Voice chat requires a modern browser with microphone support.
            Please use Chrome, Firefox, or Safari.
          </p>
        </div>
      )}

      {/* Permission Info */}
      {isSupported && permissionStatus === 'denied' && (
        <div className="text-center bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <AlertCircle className="h-6 w-6 text-red-600 mx-auto mb-2" />
          <p className="text-sm text-red-800">
            Microphone access is required. Please allow microphone access and refresh the page.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-8 text-center">
        <p className="text-sm text-gray-500">
          Powered by Trovix.ai • Voice technology by Pipecat
        </p>
      </div>
    </div>
  )
}

export default function VoiceWidgetPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="h-48 w-48 rounded-full bg-gray-200 animate-pulse"></div>
      </div>
    }>
      <VoiceWidgetContent />
    </Suspense>
  )
}