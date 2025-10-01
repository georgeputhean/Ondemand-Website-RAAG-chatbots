#!/usr/bin/env python
"""
Voice Agent Bot using Daily transport (easier than WebRTC)
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
from pipecat.transports.daily import DailyTransport, DailyParams
from pipecat.vad.silero import SileroVADAnalyzer

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
                        return result if result else "I found some information, but couldn't parse it properly."
                    else:
                        return "I couldn't access the knowledge base right now."

        except Exception as e:
            logger.error(f"RAG search error: {e}")
            return "I'm having trouble accessing the knowledge base."

async def run_bot(room_url: str, business_id: Optional[str] = None):
    """Run the voice agent bot."""

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
                "description": "Search the business knowledge base for relevant information",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query"
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

    # Context aggregator
    context = OpenAILLMContext()

    # System message
    business_context = f" for business ID {business_id}" if business_id else ""
    context.add_message({
        "role": "system",
        "content": f"""You are a helpful AI voice assistant{business_context}.

        You have access to the business's knowledge base through the search_knowledge_base function.
        When customers ask questions, search the knowledge base first to provide accurate information.

        Keep responses conversational, helpful, and concise. Be polite and professional."""
    })

    # Create transport
    transport = DailyTransport(
        room_url,
        None,  # token (not needed for testing)
        "Voice Assistant",
        DailyParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            # vad_enabled=True,
            # vad_analyzer=SileroVADAnalyzer()
        )
    )

    # Build pipeline
    pipeline = Pipeline([
        transport.input(),
        stt,
        context.user(),
        llm,
        tts,
        transport.output(),
        context.assistant(),
    ])

    # Create task
    task = PipelineTask(pipeline, PipelineParams(allow_interruptions=True))

    # Event handlers
    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant):
        logger.info(f"First participant joined: {participant}")
        await task.queue_frames([context.get_context_frame()])

    @transport.event_handler("on_participant_left")
    async def on_participant_left(transport, participant, reason):
        logger.info(f"Participant left: {participant}")
        await task.stop()

    # Run pipeline
    runner = PipelineRunner()
    await runner.run(task)

async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Daily Voice Agent")
    parser.add_argument("--business-id", help="Business ID for context")
    parser.add_argument("--room-url", default="https://test.daily.co/test-room", help="Daily room URL")

    args = parser.parse_args()

    # Validate environment variables
    if not OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY environment variable required")
        sys.exit(1)
    if not DEEPGRAM_API_KEY:
        logger.error("DEEPGRAM_API_KEY environment variable required")
        sys.exit(1)

    logger.info(f"Starting voice agent")
    logger.info(f"Room URL: {args.room_url}")
    if args.business_id:
        logger.info(f"Business ID: {args.business_id}")

    try:
        await run_bot(args.room_url, args.business_id)
    except KeyboardInterrupt:
        logger.info("Shutting down voice agent")
    except Exception as e:
        logger.error(f"Error running voice agent: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())