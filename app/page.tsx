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
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Trovix.ai - Create AI Chatbots from Your Website
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Transform your website content into an intelligent chatbot. Train on your pages, documents, and knowledge base to provide instant, accurate customer support.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-600 dark:text-blue-400 text-xl">🏢</span>
            </div>
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Register Business</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Start by registering your business and creating a dedicated space for your chatbot data.</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 dark:text-green-400 text-xl">⚙️</span>
            </div>
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Configure Chatbot</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Crawl your website, upload documents, and customize your chatbot's behavior and responses.</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-purple-600 dark:text-purple-400 text-xl">💬</span>
            </div>
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Deploy & Chat</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Your chatbot is ready! Test it, embed it on your website, or integrate it into your workflow.</p>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGetStarted}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            Get Started - Register Your Business
          </button>

          <div className="text-gray-500 dark:text-gray-400">
            <p className="text-sm">Already have a business registered? <a href="/configure-chatbot" className="text-blue-600 dark:text-blue-400 hover:underline">Configure your chatbot</a></p>
          </div>
        </div>
      </div>
    </main>
  )
}


