import './globals.css'
import React from 'react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AuthProvider } from '@/contexts/AuthContext'
import UserButton from '@/components/UserButton'

export const metadata = {
  title: 'Trovix.ai',
  description: 'Create an AI chatbot from your website content',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <AuthProvider>
          <div className="max-w-5xl mx-auto px-4 py-8">
            <header className="mb-8 flex items-center justify-between">
              <h1 className="text-2xl font-semibold">Trovix.ai</h1>
              <div className="flex items-center space-x-4">
                <a className="text-sm text-blue-600 hover:underline" href="/chat">Test Chat</a>
                <UserButton />
              </div>
            </header>
            {children}
          </div>
          <SpeedInsights />
        </AuthProvider>
      </body>
    </html>
  )
}


