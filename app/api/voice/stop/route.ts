import { NextResponse } from 'next/server'

// This endpoint is no longer needed when using a remote voice server
// The voice server lifecycle is managed separately (e.g., on Railway)

export async function POST(request: Request) {
  // When using a remote voice server, we don't stop the server
  // We just disconnect from the client side
  return NextResponse.json({
    status: 'disconnected',
    message: 'Client disconnected from voice server'
  })
}

export async function GET() {
  return NextResponse.json({
    message: 'Voice server stop endpoint - no action needed for remote servers'
  })
}
