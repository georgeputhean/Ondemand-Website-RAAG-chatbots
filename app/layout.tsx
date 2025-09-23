import './globals.css'
import React from 'react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { DarkModeProvider } from '@/contexts/DarkModeContext'
import DarkModeToggle from '@/components/DarkModeToggle'

export const metadata = {
  title: 'Trovix.ai',
  description: 'Create an AI chatbot from your website content',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <DarkModeProvider>
          <div className="max-w-5xl mx-auto px-4 py-8">
            <header className="mb-8 flex items-center justify-between">
              <h1 className="text-2xl font-semibold">Trovix.ai</h1>
              <a className="text-sm text-blue-600 dark:text-blue-400 hover:underline" href="/chat">Test Chat</a>
            </header>
            {children}
          </div>
          <DarkModeToggle />
          <SpeedInsights />
        </DarkModeProvider>
      </body>
    </html>
  )
}


