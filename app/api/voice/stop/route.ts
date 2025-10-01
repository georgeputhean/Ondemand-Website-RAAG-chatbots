import { NextResponse } from 'next/server'

// Import the voice processes map (we'll need to refactor this to a shared module)
// For now, we'll create a simple in-memory store
let voiceProcesses: Map<string, any>

// This is a temporary solution - in production, you'd want a proper process manager
if (typeof global !== 'undefined') {
  if (!global.voiceProcesses) {
    global.voiceProcesses = new Map()
  }
  voiceProcesses = global.voiceProcesses
} else {
  voiceProcesses = new Map()
}

export async function POST(request: Request) {
  try {
    const { businessId } = await request.json()
    const processKey = businessId || 'default'

    const processInfo = voiceProcesses.get(processKey)

    if (!processInfo) {
      return NextResponse.json({
        status: 'not_running',
        message: 'No voice server found for this business'
      })
    }

    // Kill the process
    try {
      processInfo.process.kill('SIGTERM')

      // Give it a moment to shut down gracefully
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Force kill if still running
      if (!processInfo.process.killed) {
        processInfo.process.kill('SIGKILL')
      }

      voiceProcesses.delete(processKey)

      return NextResponse.json({
        status: 'stopped',
        businessId,
        message: 'Voice server stopped successfully'
      })

    } catch (error) {
      console.error('Error stopping voice process:', error)
      return NextResponse.json({
        status: 'error',
        message: 'Failed to stop voice server cleanly'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Voice stop error:', error)
    return NextResponse.json(
      { error: 'Failed to stop voice server' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Return list of running processes that can be stopped
  const processes = Array.from(voiceProcesses.entries()).map(([key, info]) => ({
    key,
    businessId: info.businessId,
    port: info.port,
    pid: info.process.pid,
    canStop: !info.process.killed
  }))

  return NextResponse.json({ stoppableProcesses: processes })
}