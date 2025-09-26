"use client"
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  const handleGetStarted = () => {
    router.push('/business')
  }

  return (
    <main>
      <div className="text-center">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Trovix.ai - Create AI Chatbots from Your Website
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Transform your website content into an intelligent chatbot. Train on your pages, documents, and knowledge base to provide instant, accurate customer support.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-600 text-xl">🏢</span>
            </div>
            <h3 className="font-semibold mb-2 text-gray-900">Register Business</h3>
            <p className="text-gray-600 text-sm">Start by registering your business and creating a dedicated space for your chatbot data.</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-xl">⚙️</span>
            </div>
            <h3 className="font-semibold mb-2 text-gray-900">Configure Chatbot</h3>
            <p className="text-gray-600 text-sm">Crawl your website, upload documents, and customize your chatbot's behavior and responses.</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-purple-600 text-xl">💬</span>
            </div>
            <h3 className="font-semibold mb-2 text-gray-900">Deploy & Chat</h3>
            <p className="text-gray-600 text-sm">Your chatbot is ready! Test it, embed it on your website, or integrate it into your workflow.</p>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGetStarted}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
          >
            Get Started - Register Your Business
          </button>

          <div className="text-gray-500">
            <p className="text-sm">Already have a business registered? <a href="/configure-chatbot" className="text-blue-600 hover:underline">Configure your chatbot</a></p>
          </div>
        </div>
      </div>
    </main>
  )
}


