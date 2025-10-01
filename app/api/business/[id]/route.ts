import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[API] Fetching business:', params.id)

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 5000)
    })

    const queryPromise = supabaseAdmin
      .from('businesses')
      .select('id, url, domain, business_name, system_prompt, created_at')
      .eq('id', params.id)
      .single()

    const { data: business, error } = await Promise.race([
      queryPromise,
      timeoutPromise
    ]) as any

    if (error) {
      console.error('[API] Supabase error:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 })
      }
      throw error
    }

    console.log('[API] Business found:', business?.business_name)
    return NextResponse.json(business)
  } catch (err: any) {
    console.error('[API] Failed to fetch business:', err.message)
    return NextResponse.json({
      error: err.message || 'Failed to fetch business'
    }, { status: 500 })
  }
}