import Anthropic from '@anthropic-ai/sdk'

// ── JSON-LD helpers ──────────────────────────────────────────────────────────

function extractJsonLdRecipe(html: string): Record<string, unknown> | null {
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = scriptRe.exec(html)) !== null) {
    try {
      const raw = JSON.parse(match[1])
      const candidates = Array.isArray(raw) ? raw : raw['@graph'] ? raw['@graph'] : [raw]
      const recipe = candidates.find(
        (d: Record<string, unknown>) =>
          d['@type'] === 'Recipe' ||
          (Array.isArray(d['@type']) && (d['@type'] as string[]).includes('Recipe'))
      )
      if (recipe) return recipe
    } catch { /* skip malformed blocks */ }
  }
  return null
}

function jsonLdToResult(r: Record<string, unknown>) {
  const name = typeof r.name === 'string' ? r.name : ''
  let recipe = ''
  if (typeof r.recipeInstructions === 'string') {
    recipe = r.recipeInstructions
  } else if (Array.isArray(r.recipeInstructions)) {
    recipe = r.recipeInstructions
      .map((s: unknown) => {
        if (typeof s === 'string') return s
        if (s && typeof s === 'object') {
          const step = s as Record<string, unknown>
          return typeof step.text === 'string' ? step.text : ''
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  const rawIngredients = Array.isArray(r.recipeIngredient) ? r.recipeIngredient as string[] : []
  const ingredients = rawIngredients.map((line: string) => ({ name: line, quantity: '', unit: '' }))
  return { name, recipe, ingredients }
}

// ── Claude extraction ────────────────────────────────────────────────────────

async function claudeExtract(text: string) {
  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Extract recipe information from the text below. If not in English, translate everything. Return JSON only, no markdown fences.

Fields:
- "name": dish name in English
- "recipe": clear numbered steps in plain English a home cook can follow
- "ingredients": array of {name, quantity, unit} — empty string for missing fields

Text:
${text}`,
    }],
  })
  const raw = (message.content[0] as { text: string }).text.trim()
  const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''))
  return {
    name: typeof parsed.name === 'string' ? parsed.name : String(parsed.name ?? ''),
    recipe: typeof parsed.recipe === 'string' ? parsed.recipe : String(parsed.recipe ?? ''),
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

export interface RecipeResult {
  name: string
  recipe: string
  ingredients: { name: string; quantity: string; unit: string }[]
  image_urls: string[]
}

export async function fetchRecipeFromUrl(url: string): Promise<RecipeResult | { error: string }> {
  const TAVILY_KEY = process.env.TAVILY_API_KEY

  // 1. Try Tavily extract — handles JS-rendered pages, anti-scraping, and paywalls better than raw fetch
  if (TAVILY_KEY) {
    try {
      const res = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TAVILY_KEY}` },
        body: JSON.stringify({ urls: [url] }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      const result = data.results?.[0]
      if (result?.raw_content) {
        const image_urls = (result.images as string[] | undefined) ?? []
        const extracted = await claudeExtract(result.raw_content.slice(0, 20000))
        return { ...extracted, image_urls }
      }
    } catch { /* fall through to raw fetch */ }
  }

  // 2. Fall back: raw fetch → JSON-LD → Claude on stripped HTML
  let html: string
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HomeKiosk/1.0)' },
      signal: AbortSignal.timeout(12000),
    })
    html = await res.text()
  } catch {
    return { error: 'Could not fetch URL' }
  }

  const ogMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  const image_urls = ogMatch?.[1] ? [ogMatch[1]] : []

  const jsonLd = extractJsonLdRecipe(html)
  if (jsonLd) {
    const result = jsonLdToResult(jsonLd)
    if (result.recipe) {
      const nonAscii = /[^\x00-\x7F]/
      if (nonAscii.test(result.name) || nonAscii.test(result.recipe)) {
        const combined = `Dish name: ${result.name}\n\nIngredients:\n${result.ingredients.map(i => `${i.quantity} ${i.unit} ${i.name}`.trim()).join('\n')}\n\nInstructions:\n${result.recipe}`
        try { return { ...(await claudeExtract(combined)), image_urls } } catch { /* fall through */ }
      }
      return { ...result, image_urls }
    }
  }

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 20000)

  try {
    return { ...(await claudeExtract(stripped)), image_urls }
  } catch {
    return { error: 'Could not parse recipe data' }
  }
}
