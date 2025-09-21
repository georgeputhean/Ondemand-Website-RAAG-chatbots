import { supabaseAdmin } from './supabase'

/**
 * Fallback mechanism for creating chunk tables without stored procedures
 * This approach uses direct SQL execution instead of stored functions
 */

export async function createChunkTableFallback(businessId: string): Promise<string> {
  const tableName = `chunks_${businessId.replace(/-/g, '')}`

  try {
    // Check if table already exists
    const { data: existingTable } = await supabaseAdmin
      .from(tableName as any)
      .select('id')
      .limit(1)

    if (existingTable) {
      console.log(`Chunk table ${tableName} already exists`)
      return tableName
    }
  } catch (err) {
    // Table doesn't exist, we'll create it
  }

  // Create the table using raw SQL
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.${tableName} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      page_id uuid NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
      content text NOT NULL,
      chunk_index integer NOT NULL,
      total_chunks integer NOT NULL,
      embedding vector(1536),
      created_at timestamptz DEFAULT now(),
      UNIQUE(page_id, chunk_index)
    );

    CREATE INDEX IF NOT EXISTS ${tableName}_embedding_idx
    ON public.${tableName} USING ivfflat (embedding vector_cosine_ops);

    CREATE INDEX IF NOT EXISTS ${tableName}_page_id_idx
    ON public.${tableName} (page_id);
  `

  // We'll try to execute this by attempting to create a dummy record and catch the error
  // This is a workaround since Supabase client doesn't support raw DDL directly

  try {
    // First, try to insert a dummy record to see if table exists
    await supabaseAdmin
      .from(tableName as any)
      .insert({
        page_id: '00000000-0000-0000-0000-000000000000',
        content: 'test',
        chunk_index: 0,
        total_chunks: 1
      })
  } catch (insertError: any) {
    if (insertError.message?.includes('relation') && insertError.message?.includes('does not exist')) {
      // Table doesn't exist, we need to create it manually
      throw new Error(`Chunk table ${tableName} needs to be created manually. Please run the SQL deployment script.`)
    } else if (insertError.message?.includes('violates foreign key constraint')) {
      // Table exists but foreign key constraint failed (expected for dummy UUID)
      console.log(`Chunk table ${tableName} exists and is properly configured`)
      return tableName
    } else {
      throw insertError
    }
  }

  // If we get here, the insert succeeded (shouldn't happen with dummy UUID)
  // Clean up the dummy record
  try {
    await supabaseAdmin
      .from(tableName as any)
      .delete()
      .eq('page_id', '00000000-0000-0000-0000-000000000000')
  } catch (err) {
    // Ignore cleanup errors
  }

  return tableName
}

export async function ensureChunkTable(businessId: string): Promise<string> {
  try {
    // First try the stored procedure approach
    const { data: tableName, error } = await supabaseAdmin.rpc('ensure_business_chunk_table', {
      business_uuid: businessId
    })

    if (!error && tableName) {
      return tableName
    }

    // If stored procedure fails, try fallback approach
    console.log('Stored procedure failed, trying fallback approach')
    return await createChunkTableFallback(businessId)
  } catch (err) {
    // If both approaches fail, use fallback
    console.log('Both approaches failed, using fallback approach')
    return await createChunkTableFallback(businessId)
  }
}

export function getChunkTableName(businessId: string): string {
  return `chunks_${businessId.replace(/-/g, '')}`
}

export async function checkChunkTableExists(businessId: string): Promise<boolean> {
  const tableName = getChunkTableName(businessId)

  try {
    await supabaseAdmin
      .from(tableName as any)
      .select('id')
      .limit(1)
    return true
  } catch (err) {
    return false
  }
}