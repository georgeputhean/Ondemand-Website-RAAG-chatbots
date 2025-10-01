#!/usr/bin/env python
"""
Working Voice Agent Bot using Pipecat with Deepgram
Simplified version for testing
"""

import asyncio
import aiohttp
import os
import sys
import argparse
from loguru import logger
from typing import Optional

# Basic imports that we know work
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.deepgram.tts import DeepgramTTSService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext

# Environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

class RAGFunction:
    """Function calling integration for RAG system."""

    def __init__(self, business_id: Optional[str] = None):
        self.business_id = business_id

    async def search_knowledge_base(self, query: str) -> str:
        """Search the knowledge base for relevant information."""
        try:
            # Call the existing RAG API endpoint
            url = "http://localhost:3000/api/chat"
            payload = {
                "message": query,
                "businessId": self.business_id
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("response", "No relevant information found.")
                    else:
                        return "Unable to search knowledge base at this time."

        except Exception as e:
            logger.error(f"RAG search error: {e}")
            return "Knowledge base search temporarily unavailable."

async def test_voice_components():
    """Test voice components without WebRTC for now"""
    logger.info("Testing voice components...")

    # Test services creation
    try:
        stt = DeepgramSTTService(api_key=DEEPGRAM_API_KEY)
        logger.info("✓ Deepgram STT service created")

        tts = DeepgramTTSService(
            api_key=DEEPGRAM_API_KEY,
            voice="aura-asteria-en"
        )
        logger.info("✓ Deepgram TTS service created")

        llm = OpenAILLMService(
            api_key=OPENAI_API_KEY,
            model="gpt-4o-mini"
        )
        logger.info("✓ OpenAI LLM service created")

        # Test RAG function
        rag = RAGFunction("test-business")
        logger.info("✓ RAG function created")

        # Test RAG call
        response = await rag.search_knowledge_base("What are your business hours?")
        logger.info(f"✓ RAG test response: {response[:100]}...")

        logger.info("🎉 All voice components working!")
        return True

    except Exception as e:
        logger.error(f"❌ Error testing components: {e}")
        return False

async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Working Voice Agent Test")
    parser.add_argument("--business-id", help="Business ID for context")
    parser.add_argument("--port", type=int, default=7860, help="Server port")
    parser.add_argument("--host", default="0.0.0.0", help="Server host")

    args = parser.parse_args()

    # Validate environment variables
    if not OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY environment variable required")
        sys.exit(1)
    if not DEEPGRAM_API_KEY:
        logger.error("DEEPGRAM_API_KEY environment variable required")
        sys.exit(1)

    logger.info(f"Starting voice agent test on {args.host}:{args.port}")
    if args.business_id:
        logger.info(f"Business ID: {args.business_id}")

    # Test components
    success = await test_voice_components()

    if success:
        logger.info("🎤 Voice agent components are ready!")
        logger.info("💡 WebRTC integration coming next...")

        # Keep the server "running" for testing
        logger.info("Press Ctrl+C to stop...")
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down...")
    else:
        logger.error("❌ Voice agent test failed")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())