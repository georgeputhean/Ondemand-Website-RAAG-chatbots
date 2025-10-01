#!/usr/bin/env python
"""
Simple Deepgram-only voice bot for testing
"""

import asyncio
import os
import argparse
from loguru import logger

# Import only what we need
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.deepgram.tts import DeepgramTTSService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask

# Environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

async def simple_test():
    """Simple test without transport for now"""
    logger.info("Testing Deepgram services...")

    # Test STT service
    try:
        stt = DeepgramSTTService(api_key=DEEPGRAM_API_KEY)
        logger.info("✓ Deepgram STT service created successfully")
    except Exception as e:
        logger.error(f"✗ Deepgram STT failed: {e}")
        return

    # Test TTS service
    try:
        tts = DeepgramTTSService(
            api_key=DEEPGRAM_API_KEY,
            voice="aura-asteria-en"
        )
        logger.info("✓ Deepgram TTS service created successfully")
    except Exception as e:
        logger.error(f"✗ Deepgram TTS failed: {e}")
        return

    # Test OpenAI LLM
    try:
        llm = OpenAILLMService(
            api_key=OPENAI_API_KEY,
            model="gpt-4o-mini"
        )
        logger.info("✓ OpenAI LLM service created successfully")
    except Exception as e:
        logger.error(f"✗ OpenAI LLM failed: {e}")
        return

    logger.info("🎉 All services initialized successfully!")
    logger.info("Voice server components are ready for integration")

if __name__ == "__main__":
    if not OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY environment variable required")
        exit(1)
    if not DEEPGRAM_API_KEY:
        logger.error("DEEPGRAM_API_KEY environment variable required")
        exit(1)

    asyncio.run(simple_test())