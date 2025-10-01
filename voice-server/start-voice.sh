#!/bin/bash
echo "Starting RAAG Voice Server..."
echo

# Check if environment variables are set
if [ -z "$DEEPGRAM_API_KEY" ]; then
    echo "ERROR: DEEPGRAM_API_KEY environment variable is not set"
    echo "Please set your Deepgram API key in .env.local"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "ERROR: OPENAI_API_KEY environment variable is not set"
    echo "Please set your OpenAI API key in .env.local"
    exit 1
fi

# Default values
PORT=7860
BUSINESS_ID=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --business-id)
            BUSINESS_ID="$2"
            shift 2
            ;;
        *)
            echo "Unknown option $1"
            echo "Usage: $0 [--port PORT] [--business-id BUSINESS_ID]"
            exit 1
            ;;
    esac
done

echo "Starting voice server on port $PORT"
if [ -n "$BUSINESS_ID" ]; then
    echo "Business ID: $BUSINESS_ID"
fi
echo

# Start the voice server
if [ -z "$BUSINESS_ID" ]; then
    uv run python bot.py --port "$PORT"
else
    uv run python bot.py --port "$PORT" --business-id "$BUSINESS_ID"
fi

echo
echo "Voice server stopped."