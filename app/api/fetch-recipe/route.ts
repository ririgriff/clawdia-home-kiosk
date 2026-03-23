import { NextRequest, NextResponse } from 'next/server'
import { fetchRecipeFromUrl } from '@/lib/fetchRecipe'

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

  const result = await fetchRecipeFromUrl(url)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'Could not fetch URL' ? 422 : 500 })
  }
  return NextResponse.json(result)
}
