import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'q is required' }, { status: 400 })

  const TAVILY_KEY = process.env.TAVILY_API_KEY
  if (!TAVILY_KEY) return NextResponse.json({ error: 'Search not configured' }, { status: 503 })

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TAVILY_KEY}` },
    body: JSON.stringify({
      query: `${q} recipe`,
      search_depth: 'basic',
      include_images: true,
      max_results: 6,
    }),
    signal: AbortSignal.timeout(10000),
  })

  const data = await res.json()

  const results = (data.results ?? []).map((r: { title: string; url: string; content: string }) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
    domain: new URL(r.url).hostname.replace(/^www\./, ''),
  }))

  return NextResponse.json({ results, images: data.images ?? [] })
}
