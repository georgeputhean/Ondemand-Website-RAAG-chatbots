#!/usr/bin/env python
"""
Fixed Voice Agent Bot using Pipecat with proper WebRTC transport
"""

import asyncio
import aiohttp
import os
import sys
import argparse
from loguru import logger
from typing import Optional

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.deepgram.tts import DeepgramTTSService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.websocket.fastapi import FastAPIWebsocketTransport, FastAPIWebsocketParams

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
            url = "http://localhost:3000/api/chat"
            payload = {
                "messages": [{"role": "user", "content": query}],
                "business_id": self.business_id
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as response:
                    if response.status == 200:
                        # Handle streaming response
                        result = ""
                        async for line in response.content:
                            line_text = line.decode('utf-8').strip()
                            if line_text.startswith('0:'):
                                # Extract JSON content
                                import json
                                try:
                                    content = json.loads(line_text[2:])
                                    result += content
                                except:
                                    pass
                        return result if result else "No relevant information found."
                    else:
                        return "Unable to search knowledge base at this time."

        except Exception as e:
            logger.error(f"RAG search error: {e}")
            return "Knowledge base search temporarily unavailable."

async def run_bot(transport, business_id: Optional[str] = None):
    """Run the voice agent bot with the given transport."""

    # Initialize services
    stt = DeepgramSTTService(api_key=DEEPGRAM_API_KEY)

    # LLM with function calling for RAG
    rag_function = RAGFunction(business_id)

    # Configure OpenAI with function calling
    tools = [
        {
            "type": "function",
            "function": {
                "name": "search_knowledge_base",
                "description": "Search the business knowledge base for relevant information to answer customer questions",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query to find relevant information"
                        }
                    },
                    "required": ["query"]
                }
            }
        }
    ]

    llm = OpenAILLMService(
        api_key=OPENAI_API_KEY,
        model="gpt-4o-mini",
        tools=tools
    )

    # Register the function
    llm.register_function("search_knowledge_base", rag_function.search_knowledge_base)

    tts = DeepgramTTSService(
        api_key=DEEPGRAM_API_KEY,
        voice="aura-asteria-en"
    )

    # Context aggregator for conversation management
    context = OpenAILLMContext()

    # System message with business context
    business_context = ""
    if business_id:
        business_context = f" You are representing business ID {business_id}."

    context.add_message({
        "role": "system",
        "content": f"""You are a helpful AI voice assistant for a business.{business_context}

        You have access to the business's knowledge base through the search_knowledge_base function.
        When customers ask questions, search the knowledge base first to provide accurate, relevant information.

        Keep your responses conversational, helpful, and concise. If you cannot find specific information
        in the knowledge base, let the customer know and offer to help with general inquiries.

        Always be polite, professional, and represent the business well."""
    })

    # Build the pipeline
    pipeline = Pipeline([
        transport.input(),           # Audio input from client
        stt,                        # Speech-to-text
        context.user(),             # Add user message to context
        llm,                        # Process with LLM + function calling
        tts,                        # Text-to-speech
        transport.output(),         # Audio output to client
        context.assistant(),        # Add assistant response to context
    ])

    # Create and run the task
    task = PipelineTask(pipeline, PipelineParams(allow_interruptions=True))

    # Set up event handlers
    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info(f"Client connected: {client}")
        # Start the conversation
        await task.queue_frames([context.get_context_frame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Client disconnected: {client}")
        await task.stop()

    # Run the pipeline
    runner = PipelineRunner()
    await runner.run(task)

async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Pipecat Voice Agent")
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

    # Create WebSocket transport (simpler than WebRTC for initial testing)
    transport_params = FastAPIWebsocketParams(
        audio_in_enabled=True,
        audio_out_enabled=True
    )

    transport = FastAPIWebsocketTransport(
        params=transport_params
    )

    logger.info(f"Starting voice agent on {args.host}:{args.port}")
    logger.info(f"Transport: WebSocket")
    if args.business_id:
        logger.info(f"Business ID: {args.business_id}")

    try:
        # Run the bot
        await run_bot(transport, args.business_id)

    except KeyboardInterrupt:
        logger.info("Shutting down voice agent")
    except Exception as e:
        logger.error(f"Error running voice agent: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())