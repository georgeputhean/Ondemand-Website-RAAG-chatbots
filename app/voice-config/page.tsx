'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Settings, Mic, Construction } from 'lucide-react'
import Link from 'next/link'

export default function VoiceConfigPage() {
  const searchParams = useSearchParams()
  const businessId = searchParams.get('businessId')
  const [businessName, setBusinessName] = useState<string>('')

  // Fetch business details
  useEffect(() => {
    if (businessId) {
      fetch(`/api/business/${businessId}`)
        .then(res => res.json())
        .then(data => {
          if (data?.business_name) {
            setBusinessName(data.business_name)
          }
        })
        .catch(err => console.error('Failed to fetch business:', err))
    }
  }, [businessId])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href={businessId ? `/configure-chatbot?businessId=${businessId}` : '/configure-chatbot'}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Configuration
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Mic className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Voice Agent Configuration</h1>
              <p className="text-gray-600">
                {businessName ? `Configure voice settings for ${businessName}` : 'Configure your voice agent settings'}
              </p>
            </div>
          </div>
        </div>

        {/* Under Construction */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Construction className="w-5 h-5 text-orange-500" />
              Voice Agent Setup - Coming Soon
            </CardTitle>
            <CardDescription>
              We're implementing the latest Pipecat architecture for production-grade voice agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-3">What's Coming:</h3>
              <ul className="text-blue-800 text-sm space-y-2">
                <li>• Real-time voice conversation with your knowledge base</li>
                <li>• Industry-standard Pipecat pipeline architecture</li>
                <li>• High-quality speech recognition and synthesis</li>
                <li>• Seamless integration with your business context</li>
                <li>• Production-ready scalability</li>
              </ul>
            </div>

            <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Modern Voice Stack:</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-700">Speech-to-Text</div>
                  <div className="text-gray-600">Deepgram</div>
                </div>
                <div>
                  <div className="font-medium text-gray-700">AI Processing</div>
                  <div className="text-gray-600">Your RAG System</div>
                </div>
                <div>
                  <div className="font-medium text-gray-700">Text-to-Speech</div>
                  <div className="text-gray-600">Cartesia</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}