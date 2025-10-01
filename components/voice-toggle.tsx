'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVoiceConnection } from '@/lib/hooks/useVoiceConnection'

interface VoiceToggleProps {
  businessId?: string
  onTranscription?: (text: string) => void
  onResponse?: (text: string) => void
  className?: string
}

export function VoiceToggle({
  businessId,
  onTranscription,
  onResponse,
  className
}: VoiceToggleProps) {
  const [isSupported, setIsSupported] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt')

  const { status, startVoiceMode, stopVoiceMode, toggleMute } = useVoiceConnection({
    businessId,
    onTranscription,
    onResponse,
    onError: (error) => {
      // Show user-friendly error message instead of console warning
      console.error('Voice connection error:', error)
    }
  })

  useEffect(() => {
    // Check for WebRTC and microphone support
    const checkSupport = async () => {
      const hasWebRTC = !!(
        window.RTCPeerConnection ||
        window.webkitRTCPeerConnection ||
        window.mozRTCPeerConnection
      )

      const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)

      setIsSupported(hasWebRTC && hasMediaDevices)

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

    checkSupport()
  }, [])

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

  if (!isSupported) {
    return (
      <div className={cn('flex items-center space-x-2 text-gray-500', className)}>
        <MicOff className="h-4 w-4" />
        <span className="text-xs">Voice not supported</span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {/* Voice Mode Toggle */}
      <Button
        variant={status.isVoiceMode ? 'default' : 'outline'}
        size="sm"
        onClick={handleVoiceToggle}
        disabled={status.isConnecting}
        className={cn(
          'flex items-center space-x-2',
          status.isVoiceMode && status.isConnected && 'bg-green-600 hover:bg-green-700',
          status.isVoiceMode && !status.isConnected && 'bg-orange-600 hover:bg-orange-700',
          status.error && 'bg-red-600 hover:bg-red-700'
        )}
      >
        {status.isConnecting ? (
          <>
            <Phone className="h-4 w-4 animate-spin" />
            <span className="hidden sm:inline">Connecting...</span>
          </>
        ) : status.isVoiceMode ? (
          <>
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">
              {status.isConnected ? 'Connected' : 'Voice On'}
            </span>
          </>
        ) : (
          <>
            <PhoneOff className="h-4 w-4" />
            <span className="hidden sm:inline">Start Voice</span>
          </>
        )}
      </Button>

      {/* Error indicator */}
      {status.error && (
        <div className="flex items-center space-x-1 text-red-600" title={status.error}>
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs max-w-32 truncate">
            {status.error.includes('Voice functionality is currently unavailable')
              ? 'Voice unavailable'
              : status.error.length > 20
                ? status.error.substring(0, 20) + '...'
                : status.error}
          </span>
        </div>
      )}

      {/* Mute Toggle (only when voice mode is active) */}
      {status.isVoiceMode && (
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMute}
          className={cn(
            'flex items-center space-x-1',
            status.isMuted && 'bg-red-100 border-red-300 text-red-700'
          )}
        >
          {status.isMuted ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {status.isMuted ? 'Unmute' : 'Mute'}
          </span>
        </Button>
      )}

      {/* Voice Status Indicator */}
      {status.isVoiceMode && (
        <div className="flex items-center space-x-1">
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              status.isConnected ? 'bg-green-500 animate-pulse' : 'bg-orange-500'
            )}
          />
          <span className="text-xs text-gray-600">
            {status.isConnected ? 'Live' : status.isConnecting ? 'Connecting' : 'Offline'}
          </span>
          {status.port && (
            <span className="text-xs text-gray-400">:{status.port}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default VoiceToggle