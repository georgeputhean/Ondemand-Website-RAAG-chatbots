import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const port = searchParams.get('port') || '7860'

    // Check if voice server is responding
    try {
      const response = await fetch(`http://localhost:${port}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })

      if (response.ok) {
        return NextResponse.json({
          status: 'healthy',
          port: parseInt(port),
          businessId,
          message: 'Voice server is responding'
        })
      } else {
        return NextResponse.json({
          status: 'unhealthy',
          port: parseInt(port),
          businessId,
          message: `Voice server returned ${response.status}`
        })
      }

    } catch (fetchError) {
      // If fetch fails, the server is likely not running
      return NextResponse.json({
        status: 'offline',
        port: parseInt(port),
        businessId,
        message: 'Voice server is not responding'
      })
    }

  } catch (error) {
    console.error('Voice status check error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to check voice server status'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { businessId, port = 7860 } = await request.json()

    // Ping the voice server WebRTC endpoint
    try {
      const response = await fetch(`http://localhost:${port}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      })

      const status = response.ok ? 'ready' : 'starting'

      return NextResponse.json({
        status,
        port,
        businessId,
        webrtcReady: response.ok,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      return NextResponse.json({
        status: 'offline',
        port,
        businessId,
        webrtcReady: false,
        timestamp: new Date().toISOString(),
        error: 'Connection failed'
      })
    }

  } catch (error) {
    console.error('Voice ping error:', error)
    return NextResponse.json(
      { error: 'Failed to ping voice server' },
      { status: 500 }
    )
  }
}