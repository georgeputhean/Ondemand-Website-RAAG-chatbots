import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data: business, error } = await supabaseAdmin
      .from('businesses')
      .select('id, url, domain, business_name, system_prompt, created_at')
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json(business)
  } catch (err: any) {
    console.error('Failed to fetch business:', err)
    return NextResponse.json({
      error: err.message || 'Failed to fetch business'
    }, { status: 500 })
  }
}