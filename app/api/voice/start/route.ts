import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

// Store active voice processes
const voiceProcesses = new Map<string, any>()

export async function POST(request: Request) {
  try {
    const { businessId } = await request.json()

    // Check if there's already a voice server running for this business
    const processKey = businessId || 'default'

    if (voiceProcesses.has(processKey)) {
      return NextResponse.json({
        status: 'already_running',
        port: 7860 + (businessId ? parseInt(businessId.slice(-2), 16) % 100 : 0)
      })
    }

    // Start voice server process
    const voiceServerPath = path.join(process.cwd(), 'voice-server')
    const port = 7860 // Use fixed port for now

    const env = {
      ...process.env,
      DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    }

    const args = ['run', 'python', 'simple_server.py', '--port', port.toString()]
    if (businessId) {
      args.push('--business-id', businessId)
    }

    const voiceProcess = spawn('uv', args, {
      cwd: voiceServerPath,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Store the process
    voiceProcesses.set(processKey, {
      process: voiceProcess,
      port,
      businessId,
      startTime: Date.now()
    })

    // Handle process events
    voiceProcess.on('error', (error) => {
      console.error('Voice process error:', error)
      voiceProcesses.delete(processKey)
    })

    voiceProcess.on('exit', (code) => {
      console.log(`Voice process exited with code ${code}`)
      voiceProcesses.delete(processKey)
    })

    // Log output for debugging
    voiceProcess.stdout?.on('data', (data) => {
      console.log(`Voice server stdout: ${data}`)
    })

    voiceProcess.stderr?.on('data', (data) => {
      console.error(`Voice server stderr: ${data}`)
    })

    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 3000))

    return NextResponse.json({
      status: 'started',
      port,
      businessId,
      processId: voiceProcess.pid
    })

  } catch (error) {
    console.error('Voice start error:', error)
    return NextResponse.json(
      { error: 'Failed to start voice server' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Return status of all running voice servers
  const status = Array.from(voiceProcesses.entries()).map(([key, info]) => ({
    key,
    port: info.port,
    businessId: info.businessId,
    uptime: Date.now() - info.startTime,
    pid: info.process.pid
  }))

  return NextResponse.json({ voiceServers: status })
}