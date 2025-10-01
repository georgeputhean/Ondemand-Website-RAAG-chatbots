'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import VoiceToggle from '@/components/voice-toggle'
import VoiceIndicator from '@/components/voice-indicator'
import { Mic, MessageSquare, Bot, Volume2, Settings, Play } from 'lucide-react'

export default function VoiceDemoPage() {
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [demoStep, setDemoStep] = useState(0)

  // Demo scenarios
  const demoScenarios = [
    {
      title: "Customer Support",
      description: "Ask about business hours, location, or services",
      sampleQuestions: [
        "What are your business hours?",
        "Where are you located?",
        "What services do you offer?"
      ]
    },
    {
      title: "Product Information",
      description: "Get details about products or pricing",
      sampleQuestions: [
        "Tell me about your products",
        "What are your prices?",
        "Do you have any special offers?"
      ]
    },
    {
      title: "Booking & Reservations",
      description: "Make appointments or reservations",
      sampleQuestions: [
        "Can I make a reservation?",
        "What time slots are available?",
        "How do I book an appointment?"
      ]
    }
  ]

  // Simulate voice connection
  useEffect(() => {
    if (isVoiceMode) {
      // Simulate connection delay
      setTimeout(() => setIsConnected(true), 2000)
    } else {
      setIsConnected(false)
      setIsListening(false)
      setIsSpeaking(false)
      setTranscription('')
    }
  }, [isVoiceMode])

  const handleDemoAction = (action: string) => {
    switch (action) {
      case 'listen':
        setIsListening(true)
        setIsSpeaking(false)
        setTranscription('Hi, can you tell me about your business hours?')
        setTimeout(() => {
          setIsListening(false)
          setIsSpeaking(true)
          setTranscription('')
        }, 3000)
        setTimeout(() => {
          setIsSpeaking(false)
        }, 5000)
        break
      case 'speak':
        setIsSpeaking(true)
        setIsListening(false)
        setTimeout(() => setIsSpeaking(false), 3000)
        break
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎤 Voice Agent Demo
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Experience the future of customer support with AI-powered voice conversations.
            Speak naturally and get intelligent responses in real-time.
          </p>
        </div>

        {/* Main Demo Area */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Voice Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mic className="h-5 w-5" />
                <span>Voice Controls</span>
              </CardTitle>
              <CardDescription>
                Try the voice interface and see real-time interaction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Voice Toggle */}
              <div className="flex flex-col space-y-4">
                <VoiceToggle
                  businessId="demo-business"
                  onTranscription={(text) => console.log('Transcription:', text)}
                  onResponse={(text) => console.log('Response:', text)}
                />

                {/* Voice Indicator */}
                <VoiceIndicator
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  transcription={transcription}
                />
              </div>

              {/* Demo Action Buttons */}
              {isVoiceMode && isConnected && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDemoAction('listen')}
                    className="flex items-center space-x-2"
                  >
                    <Mic className="h-4 w-4" />
                    <span>Demo Speaking</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDemoAction('speak')}
                    className="flex items-center space-x-2"
                  >
                    <Volume2 className="h-4 w-4" />
                    <span>Demo Response</span>
                  </Button>
                </div>
              )}

              {/* Status */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Voice Status</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Voice Mode:</span>
                    <span className={isVoiceMode ? 'text-green-600' : 'text-gray-500'}>
                      {isVoiceMode ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connection:</span>
                    <span className={isConnected ? 'text-green-600' : 'text-orange-600'}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Microphone:</span>
                    <span className={isMuted ? 'text-red-600' : 'text-green-600'}>
                      {isMuted ? 'Muted' : 'Active'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Demo Scenarios */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5" />
                <span>Demo Scenarios</span>
              </CardTitle>
              <CardDescription>
                Try these sample conversations to see the voice agent in action
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {demoScenarios.map((scenario, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">{scenario.title}</h4>
                  <p className="text-sm text-gray-600 mb-3">{scenario.description}</p>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-500 mb-1">Sample Questions:</div>
                    {scenario.sampleQuestions.map((question, qIndex) => (
                      <div key={qIndex} className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTranscription(question)}
                          className="flex-1 justify-start text-xs h-8"
                        >
                          <Play className="h-3 w-3 mr-2" />
                          "{question}"
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <Bot className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">AI-Powered Responses</h3>
              <p className="text-sm text-gray-600">
                Get intelligent answers based on your business data and context
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Volume2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Real-Time Voice</h3>
              <p className="text-sm text-gray-600">
                Natural conversation flow with ultra-low latency responses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Settings className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Business Context</h3>
              <p className="text-sm text-gray-600">
                Trained on your specific business information and requirements
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle>Ready to Add Voice to Your Business?</CardTitle>
            <CardDescription>
              Follow these steps to enable voice chat for your customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-semibold">
                  1
                </div>
                <h4 className="font-medium mb-1">Configure Business</h4>
                <p className="text-sm text-gray-600">Set up your business profile and voice settings</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-semibold">
                  2
                </div>
                <h4 className="font-medium mb-1">Train Voice Agent</h4>
                <p className="text-sm text-gray-600">Upload content and customize voice responses</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-semibold">
                  3
                </div>
                <h4 className="font-medium mb-1">Deploy Widget</h4>
                <p className="text-sm text-gray-600">Add the voice-enabled chat widget to your website</p>
              </div>
            </div>

            <div className="flex justify-center mt-6">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Get Started with Voice AI
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}