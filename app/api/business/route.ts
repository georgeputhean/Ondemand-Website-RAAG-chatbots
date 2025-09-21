import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { ensureChunkTable } from '@/lib/chunk-table-fallback'

const schema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  website: z.string().url('Valid website URL is required')
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessName, website } = schema.parse(body)

    // Extract domain from website URL
    const domain = new URL(website).hostname

    // Check if business already exists
    const { data: existingBusiness } = await supabaseAdmin
      .from('businesses')
      .select('id, business_name')
      .eq('domain', domain)
      .maybeSingle()

    if (existingBusiness) {
      return NextResponse.json({
        businessId: existingBusiness.id,
        message: 'Business already exists',
        existing: true
      })
    }

    // Create new business
    const { data: newBusiness, error: createError } = await supabaseAdmin
      .from('businesses')
      .insert({
        url: website,
        domain,
        business_name: businessName
      })
      .select('id')
      .single()

    if (createError) {
      throw new Error(`Failed to create business: ${createError.message}`)
    }

    // Create chunk table for this business (with fallback mechanism)
    try {
      const tableName = await ensureChunkTable(newBusiness.id)
      console.log(`Successfully ensured chunk table exists: ${tableName}`)
    } catch (err: any) {
      console.error('Chunk table creation error:', err)
      return NextResponse.json({
        businessId: newBusiness.id,
        message: 'Business registered but chunk table creation failed',
        error: err.message,
        existing: false,
        needsSetup: true
      }, { status: 500 })
    }

    return NextResponse.json({
      businessId: newBusiness.id,
      message: 'Business registered successfully',
      existing: false
    })
  } catch (err: any) {
    console.error('Business registration error:', err)

    if (err instanceof z.ZodError) {
      return NextResponse.json({
        error: err.errors[0].message
      }, { status: 400 })
    }

    return NextResponse.json({
      error: err.message || 'Failed to register business'
    }, { status: 500 })
  }
}