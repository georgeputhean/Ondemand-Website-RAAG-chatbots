#!/usr/bin/env python
"""
Simple HTTP server for voice agent status
"""

import asyncio
import aiohttp
import os
import sys
import argparse
from aiohttp import web
from loguru import logger
from typing import Optional

# Environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
NEXT_APP_URL = os.getenv("NEXT_APP_URL", "http://localhost:3000")

class VoiceAgent:
    """Simple voice agent that can handle HTTP requests."""

    def __init__(self, business_id: Optional[str] = None):
        self.business_id = business_id
        self.is_ready = False
        self._initialize()

    def _initialize(self):
        """Initialize the voice agent components."""
        try:
            # Test imports and services
            from pipecat.services.deepgram.stt import DeepgramSTTService
            from pipecat.services.deepgram.tts import DeepgramTTSService
            from pipecat.services.openai.llm import OpenAILLMService

            # Create services to verify they work
            stt = DeepgramSTTService(api_key=DEEPGRAM_API_KEY)
            tts = DeepgramTTSService(api_key=DEEPGRAM_API_KEY, voice="aura-asteria-en")
            llm = OpenAILLMService(api_key=OPENAI_API_KEY, model="gpt-4o-mini")

            self.is_ready = True
            logger.info("✓ Voice agent components initialized successfully")

        except Exception as e:
            logger.error(f"❌ Failed to initialize voice agent: {e}")
            self.is_ready = False

    async def search_knowledge_base(self, query: str) -> str:
        """Search the knowledge base via RAG API."""
        try:
            url = f"{NEXT_APP_URL}/api/chat"
            payload = {
                "messages": [{"role": "user", "content": query}],
                "business_id": self.business_id  # Use snake_case to match schema
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as response:
                    if response.status == 200:
                        # Handle streaming response
                        result = ""
                        async for line in response.content:
                            line_text = line.decode('utf-8').strip()
                            if line_text.startswith('0:'):
                                import json
                                try:
                                    content = json.loads(line_text[2:])
                                    result += content
                                except:
                                    pass
                        return result if result else "Found information but couldn't parse it."
                    else:
                        return f"RAG API returned {response.status}"

        except Exception as e:
            logger.error(f"RAG search error: {e}")
            return f"Error: {str(e)}"

# Global voice agent instance
voice_agent = None

async def health_check(request):
    """Health check endpoint."""
    global voice_agent

    if voice_agent and voice_agent.is_ready:
        return web.json_response({
            "status": "healthy",
            "ready": True,
            "business_id": voice_agent.business_id,
            "services": ["deepgram_stt", "deepgram_tts", "openai_llm", "rag_api"]
        })
    else:
        return web.json_response({
            "status": "not_ready",
            "ready": False
        }, status=503)

async def test_rag(request):
    """Test RAG endpoint."""
    global voice_agent

    if not voice_agent or not voice_agent.is_ready:
        return web.json_response({"error": "Voice agent not ready"}, status=503)

    try:
        data = await request.json()
        query = data.get("query", "What are your business hours?")

        result = await voice_agent.search_knowledge_base(query)

        return web.json_response({
            "query": query,
            "response": result,
            "business_id": voice_agent.business_id
        })

    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

async def voice_status(request):
    """Voice status endpoint."""
    global voice_agent

    return web.json_response({
        "voice_server": "running",
        "components_ready": voice_agent.is_ready if voice_agent else False,
        "business_id": voice_agent.business_id if voice_agent else None,
        "webrtc_available": False,  # Will be True when WebRTC is working
        "websocket_available": False,  # Will be True when WebSocket is working
        "http_api": True
    })

@web.middleware
async def cors_middleware(request, handler):
    """Add CORS headers to all responses."""
    if request.method == "OPTIONS":
        # Handle preflight requests
        response = web.Response()
    else:
        response = await handler(request)

    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

async def init_app():
    """Initialize the web application."""
    app = web.Application(middlewares=[cors_middleware])

    # Add routes
    app.router.add_get("/health", health_check)
    app.router.add_get("/status", voice_status)
    app.router.add_post("/test-rag", test_rag)
    app.router.add_get("/", voice_status)  # Default route

    return app

async def main():
    """Main entry point."""
    global voice_agent

    parser = argparse.ArgumentParser(description="Simple Voice Server")
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

    # Initialize voice agent
    voice_agent = VoiceAgent(args.business_id)

    if not voice_agent.is_ready:
        logger.error("Failed to initialize voice agent")
        sys.exit(1)

    # Create web app
    app = await init_app()

    logger.info(f"Starting simple voice server on {args.host}:{args.port}")
    if args.business_id:
        logger.info(f"Business ID: {args.business_id}")

    # Start server
    runner = web.AppRunner(app)
    await runner.setup()

    site = web.TCPSite(runner, args.host, args.port)
    await site.start()

    logger.info(f"🎤 Voice server ready at http://{args.host}:{args.port}")
    logger.info("Endpoints:")
    logger.info("  GET  /health - Health check")
    logger.info("  GET  /status - Voice server status")
    logger.info("  POST /test-rag - Test RAG integration")

    try:
        # Keep the server running
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down voice server")
    finally:
        await runner.cleanup()

if __name__ == "__main__":
    asyncio.run(main())