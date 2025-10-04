import { NextResponse } from 'next/server'

// Voice server URL from environment variable
const VOICE_SERVER_URL = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || 'http://localhost:7860'

// Check voice server health and connect
export async function POST(request: Request) {
  try {
    const { businessId } = await request.json()

    // Check if voice server is healthy
    const healthResponse = await fetch(`${VOICE_SERVER_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!healthResponse.ok) {
      return NextResponse.json(
        {
          error: 'Voice server is not responding. Please try again later.',
          serverUrl: VOICE_SERVER_URL
        },
        { status: 503 }
      )
    }

    const healthData = await healthResponse.json()

    if (!healthData.ready) {
      return NextResponse.json(
        { error: 'Voice server is not ready' },
        { status: 503 }
      )
    }

    return NextResponse.json({
      status: 'connected',
      serverStatus: healthData,
      serverUrl: VOICE_SERVER_URL,
      businessId
    })

  } catch (error) {
    console.error('Voice connection error:', error)
    return NextResponse.json(
      {
        error: 'Failed to connect to voice server.',
        serverUrl: VOICE_SERVER_URL
      },
      { status: 500 }
    )
  }
}

// Get voice server status
export async function GET() {
  try {
    const statusResponse = await fetch(`${VOICE_SERVER_URL}/status`, {
      cache: 'no-store'
    })

    if (!statusResponse.ok) {
      return NextResponse.json({
        status: 'offline',
        serverUrl: VOICE_SERVER_URL
      })
    }

    const statusData = await statusResponse.json()

    return NextResponse.json({
      status: 'online',
      serverInfo: statusData,
      serverUrl: VOICE_SERVER_URL
    })

  } catch (error) {
    return NextResponse.json({
      status: 'offline',
      error: 'Could not reach voice server',
      serverUrl: VOICE_SERVER_URL
    })
  }
}
