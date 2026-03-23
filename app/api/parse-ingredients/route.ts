import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  const { recipe } = await request.json()

  if (!recipe?.trim()) {
    return NextResponse.json({ error: 'Recipe text is required' }, { status: 400 })
  }

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Extract the ingredient list from this recipe. Return ONLY a valid JSON array of objects with exactly these three fields: "name" (string), "quantity" (string), "unit" (string). If quantity or unit is not specified, use an empty string. Do not include any explanation or markdown — only the raw JSON array.

Recipe:
${recipe}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected response from Claude' }, { status: 500 })
  }

  try {
    // Strip any accidental markdown fences
    const raw = content.text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const ingredients = JSON.parse(raw)
    return NextResponse.json({ ingredients })
  } catch {
    return NextResponse.json({ error: 'Failed to parse ingredient list' }, { status: 500 })
  }
}
