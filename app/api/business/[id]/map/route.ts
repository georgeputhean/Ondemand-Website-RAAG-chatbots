import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { discoverWebsiteUrls } from '@/lib/groqcrawl'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const businessId = params.id

    // Verify business exists and get URL
    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id, url, domain')
      .eq('id', businessId)
      .single()

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    console.log(`Discovering URLs for business ${businessId}: ${business.url}`)

    // Discover URLs using GroqCrawl
    const discoveryResult = await discoverWebsiteUrls(business.url)
    const discoveredPages = discoveryResult.pages

    console.log(`Discovered ${discoveredPages.length} URLs (sitemap: ${discoveryResult.sitemapFound ? `${discoveryResult.sitemapUrls} URLs` : 'not found'}, links: ${discoveryResult.linksDiscovered})`)

    // Smart rediscovery: show ALL discovered pages (new and existing) for user selection
    const { data: existingPages } = await supabaseAdmin
      .from('pages')
      .select('url, is_selected, is_processed, id, title')
      .eq('business_id', businessId)

    // Create a map of existing pages for quick lookup
    const existingPagesMap = new Map(
      (existingPages || []).map(page => [page.url, page])
    )

    const discoveredUrls = new Set(discoveredPages.map(p => p.url))
    console.log(`Existing pages: ${existingPagesMap.size}, Discovered: ${discoveredPages.length}`)

    // 1. Remove pages that no longer exist on the website (only unprocessed ones)
    const urlsToRemove = Array.from(existingPagesMap.keys()).filter(url => !discoveredUrls.has(url))
    if (urlsToRemove.length > 0) {
      console.log(`Removing ${urlsToRemove.length} pages that no longer exist`)
      await supabaseAdmin
        .from('pages')
        .delete()
        .eq('business_id', businessId)
        .eq('is_processed', false)
        .in('url', urlsToRemove)
    }

    // 2. Process ALL discovered pages (upsert approach)
    console.log(`Processing ${discoveredPages.length} discovered pages (new and existing)`)

    for (const discoveredPage of discoveredPages) {
      const existingPage = existingPagesMap.get(discoveredPage.url)

      if (existingPage) {
        // Update existing page with fresh title and discovery timestamp
        await supabaseAdmin
          .from('pages')
          .update({
            title: discoveredPage.title,
            discovered_at: new Date().toISOString()
          })
          .eq('business_id', businessId)
          .eq('url', discoveredPage.url)
      } else {
        // Insert new page
        await supabaseAdmin
          .from('pages')
          .insert({
            business_id: businessId,
            url: discoveredPage.url,
            title: discoveredPage.title,
            raw_content: null,
            is_processed: false,
            is_selected: false, // New pages start unselected
            discovered_at: new Date().toISOString()
          })
      }
    }

    // Return ALL pages (both processed and unprocessed) for user selection
    const { data: savedPages, error: fetchError } = await supabaseAdmin
      .from('pages')
      .select('id, url, title, is_selected, discovered_at, is_processed')
      .eq('business_id', businessId)
      .order('url')

    if (fetchError) {
      throw new Error(`Failed to fetch saved pages: ${fetchError.message}`)
    }

    return NextResponse.json({
      success: true,
      pagesDiscovered: discoveredPages.length,
      pages: savedPages || [],
      discoveryInfo: {
        sitemapFound: discoveryResult.sitemapFound,
        sitemapUrls: discoveryResult.sitemapUrls,
        linksDiscovered: discoveryResult.linksDiscovered,
        filteringStats: discoveryResult.filteringStats
      }
    })

  } catch (error: any) {
    console.error('URL discovery error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to discover URLs'
    }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const businessId = params.id

    // Get existing discovered pages
    const { data: pages, error } = await supabaseAdmin
      .from('pages')
      .select('id, url, title, is_selected, discovered_at, is_processed')
      .eq('business_id', businessId)
      .order('url')

    if (error) {
      throw error
    }

    return NextResponse.json({
      pages: pages || []
    })

  } catch (error: any) {
    console.error('Failed to fetch discovered pages:', error)
    return NextResponse.json({
      error: error.message || 'Failed to fetch pages'
    }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const businessId = params.id
    const { selectedPageIds } = await request.json()

    console.log('PATCH /api/business/[id]/map called:', { businessId, selectedPageIds })

    if (!Array.isArray(selectedPageIds)) {
      return NextResponse.json(
        { error: 'selectedPageIds must be an array' },
        { status: 400 }
      )
    }

    // Reset all pages to unselected
    console.log('Resetting all pages to unselected for business:', businessId)
    const { error: resetError } = await supabaseAdmin
      .from('pages')
      .update({ is_selected: false })
      .eq('business_id', businessId)

    if (resetError) {
      console.error('Failed to reset page selections:', resetError)
      throw new Error(`Failed to reset selections: ${resetError.message}`)
    }

    // Set selected pages to true
    if (selectedPageIds.length > 0) {
      console.log('Setting selected pages to true:', selectedPageIds)
      const { error: selectError } = await supabaseAdmin
        .from('pages')
        .update({ is_selected: true })
        .eq('business_id', businessId)
        .in('id', selectedPageIds)

      if (selectError) {
        console.error('Failed to set page selections:', selectError)
        throw new Error(`Failed to update selections: ${selectError.message}`)
      }
    }

    console.log('Successfully updated page selections')
    return NextResponse.json({
      success: true,
      selectedCount: selectedPageIds.length
    })

  } catch (error: any) {
    console.error('Failed to update page selections:', error)
    return NextResponse.json({
      error: error.message || 'Failed to update selections'
    }, { status: 500 })
  }
}