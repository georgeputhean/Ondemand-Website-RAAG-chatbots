# RAAG Voice Server

A production-ready voice agent server using Pipecat framework with Deepgram STT/TTS and OpenAI LLM, integrated with the existing RAG system.

## Features

- **Real-time voice conversations** using WebRTC
- **Deepgram Nova-2 STT** for speech recognition (~150ms latency)
- **Deepgram Aura-2 TTS** for speech synthesis (~100ms first audio)
- **OpenAI GPT-4o-mini** for conversation processing
- **RAG integration** with existing knowledge base via `/api/chat` endpoint
- **Business context support** for multi-tenant usage
- **Cost-optimized** at ~$1.83/hour for continuous conversation

## Quick Start

### Prerequisites

1. **API Keys** (add to `.env.local` in the main project):
   ```bash
   DEEPGRAM_API_KEY=your_deepgram_key_here
   OPENAI_API_KEY=your_openai_key_here
   ```

2. **Python Dependencies**:
   ```bash
   uv sync  # Install all dependencies
   ```

### Running the Voice Server

#### Option 1: Using startup scripts
```bash
# Windows
start-voice.bat

# Linux/Mac
./start-voice.sh

# With custom port and business ID
./start-voice.sh --port 7861 --business-id "abc123"
```

#### Option 2: Direct Python command
```bash
uv run python bot.py --port 7860 --business-id "your-business-id"
```

## Architecture

```
[Frontend] <-- WebRTC --> [Voice Server] <-- HTTP --> [Next.js API /api/chat]
                   |
                   v
           [Deepgram STT] -> [OpenAI LLM] -> [Deepgram TTS]
                              |
                              v
                         [RAG Function] -> [Knowledge Base]
```

## API Integration

The voice server integrates seamlessly with your existing chat API:
- Calls `http://localhost:3000/api/chat` for all conversations
- Supports business-specific knowledge bases
- Maintains conversation context
- Inherits all existing RAG capabilities

## Cost Analysis

**Per minute costs (estimated):**
- Deepgram STT: ~$0.0125
- Deepgram TTS: ~$0.018
- OpenAI GPT-4o-mini: ~$0.002
- **Total: ~$0.0305/minute (~$1.83/hour)**

## Configuration

### Environment Variables
- `DEEPGRAM_API_KEY` - Required for speech recognition and synthesis
- `OPENAI_API_KEY` - Required for conversation processing

### Command Line Options
- `--port PORT` - Server port (default: 7860)
- `--host HOST` - Server host (default: 0.0.0.0)
- `--business-id ID` - Business context for RAG queries
- `--transport TYPE` - Transport type (default: webrtc)

## Integration with Frontend

The voice server is automatically managed by the Next.js API:
- `POST /api/voice/start` - Starts voice server
- `POST /api/voice/stop` - Stops voice server
- `GET /api/voice/status` - Checks server status

Frontend components:
- `VoiceToggle` - Main voice control component
- `useVoiceConnection` - React hook for WebRTC connection
- Integrated in chat widget and demo pages

## Troubleshooting

### Common Issues

1. **"No module named 'deepgram'"**
   ```bash
   cd voice-server
   uv add "pipecat-ai[deepgram,openai,silero,webrtc]"
   ```

2. **WebRTC connection fails**
   - Check firewall settings
   - Ensure port 7860 (or custom port) is available
   - Verify HTTPS is used for production (WebRTC requirement)

3. **Voice server won't start**
   - Verify API keys are set in environment
   - Check port availability
   - Review console logs for specific errors

### Logs and Debugging

The voice server provides detailed logging:
- Connection events
- Audio processing status
- RAG function calls
- Error messages with context

## Production Deployment

For production deployment:

1. **HTTPS Required** - WebRTC requires secure connections
2. **Process Management** - Use PM2 or similar for server management
3. **Load Balancing** - Multiple voice server instances for scaling
4. **Monitoring** - Track conversation metrics and costs
5. **Security** - API key protection and rate limiting

## Development

### Testing Voice Services
```bash
# Test Deepgram services without WebRTC
uv run python simple_bot.py
```

### Code Structure
- `bot.py` - Main voice agent implementation
- `simple_bot.py` - Service testing without WebRTC
- `start-voice.*` - Startup scripts for different platforms

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Next.js server logs (`npm run dev`)
3. Check voice server console output
4. Verify API keys and permissions