import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { connectDB } from '@/lib/mongodb'
import { Dish } from '@/lib/models/Dish'
import { MealPlan } from '@/lib/models/MealPlan'
import { TodoItem } from '@/lib/models/TodoItem'
import { ScheduleEvent } from '@/lib/models/ScheduleEvent'
import { Link as LinkModel } from '@/lib/models/Link'
import { Settings } from '@/lib/models/Settings'
import { computeHomeMethod, FALLBACK_HOME_DEFAULTS, HomeMethod } from '@/lib/home-method'
import { fetchRecipeFromUrl } from '@/lib/fetchRecipe'
import { TIMEZONE, APP_NAME, FAMILY_DESCRIPTION, TODO_ASSIGNEES, MEAL_SHORTCUTS, MEAL_MEMBERS, SCHOOL_CHILD, ENABLE_GO_HOME, PARTICIPANTS } from '@/config/family'
import { LINK_CATEGORIES } from '@/lib/types'

const anthropic = new Anthropic()

// ─── System Prompt ────────────────────────────────────────────────────────────
// Edit this constant to add more context about your family, preferences, and rules.
// {TODAY_DATETIME} is replaced at request time with the current HK date and time.
const SYSTEM_PROMPT = `\
You are ${APP_NAME}, a friendly and practical AI assistant for the family's home kiosk app.

Today: {TODAY_DATETIME}

## Family
${FAMILY_DESCRIPTION}

## What you can do
You have tools to read and write all app data:
- **Meal plan** — view what's planned, add or remove meals
- **Dishes** — search the dish library, submit new dishes for review
- **To-dos** — view, add, complete, and delete to-do items
- **Schedule** — view, add, edit, and delete calendar events
- **Links** — view and add useful links

## Rules
- New dishes land as **pending** and need manual review before appearing in the active list. Always tell the user to check the Review tab on the Manage Dishes page.
- Meal slots: breakfast, lunch, snack, dinner
- Meal plan eaters: array of member IDs — ${MEAL_MEMBERS.map(m => m.id).join(', ')}. Shortcuts: ${MEAL_SHORTCUTS.map(s => `"${s.label}" = [${s.members.join(', ')}]`).join(', ')}
- Todo assignees: ${TODO_ASSIGNEES.map(a => a.value).join(', ')}
- All dates: YYYY-MM-DD. Timed events: YYYY-MM-DDTHH:MM (24h, HK time) with all_day: false. All-day events: YYYY-MM-DD with all_day: true.
## Adding dishes
When asked to add dishes you don't have details for, use this workflow:
1. **search_web** — find a good recipe page (e.g. "X recipe site:allrecipes.com" or "X 食譜")
2. **fetch_dish_info** — extract name, ingredients, recipe, and image from the best URL
3. **create_dish** — submit with the extracted details

Briefly tell the user what you found and confirm before creating. If multiple dishes are requested, do them one at a time so the user can see progress.

- Be concise, warm, and practical. If you need clarification, ask one focused question.`

// ─── Tool definitions ─────────────────────────────────────────────────────────
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_meal_plan',
    description: 'Get the meal plan for a date or range of dates, enriched with dish names',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_from: { type: 'string', description: 'Start date YYYY-MM-DD' },
        date_to:   { type: 'string', description: 'End date YYYY-MM-DD (optional, defaults to date_from)' },
      },
      required: ['date_from'],
    },
  },
  {
    name: 'search_dishes',
    description: 'Search or list dishes by name, category, or tags',
    input_schema: {
      type: 'object' as const,
      properties: {
        query:          { type: 'string',  description: 'Name search string (optional)' },
        category:       { type: 'string',  description: 'Category slug e.g. soup, main-protein (optional)' },
        tag:            { type: 'string',  description: 'Tag to filter by e.g. chicken, quick (optional)' },
        available_only: { type: 'boolean', description: 'Only return available dishes' },
      },
    },
  },
  {
    name: 'add_meal_to_plan',
    description: 'Schedule a dish for a specific date, slot, and set of people',
    input_schema: {
      type: 'object' as const,
      properties: {
        date:    { type: 'string', description: 'Date YYYY-MM-DD' },
        slot:    { type: 'string', enum: ['breakfast', 'lunch', 'snack', 'dinner'] },
        dish_id: { type: 'string', description: '_id of the dish' },
        eaters:  { type: 'array', items: { type: 'string' }, description: `Member IDs eating this meal, e.g. ${JSON.stringify(MEAL_SHORTCUTS[0]?.members ?? [])}. Available: ${MEAL_MEMBERS.map(m => m.id).join(', ')}` },
      },
      required: ['date', 'slot', 'dish_id', 'eaters'],
    },
  },
  {
    name: 'remove_meal_from_plan',
    description: 'Remove a meal plan entry by its _id',
    input_schema: {
      type: 'object' as const,
      properties: {
        entry_id: { type: 'string' },
      },
      required: ['entry_id'],
    },
  },
  {
    name: 'update_dish',
    description: 'Update fields on an existing dish (notes, critical_notes, tags, available, typically_served). Use search_dishes first to get the dish _id.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:               { type: 'string',  description: '_id of the dish to update' },
        notes:            { type: 'string' },
        critical_notes:   { type: 'string',  description: 'Allergy or key preparation warnings — always shown in red' },
        tags:             { type: 'array',   items: { type: 'string' } },
        available:        { type: 'boolean' },
        typically_served: { type: 'array',   items: { type: 'string', enum: ['breakfast', 'lunch', 'snack', 'dinner'] } },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_dish',
    description: 'Submit a new dish for review. It lands as pending — tell the user to check the Review tab.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name:             { type: 'string' },
        name_zh:          { type: 'string',  description: 'Chinese name (optional)' },
        category:         { type: 'array',   items: { type: 'string' }, description: 'Array of category slugs e.g. ["soup","vegetable"]' },
        tags:             { type: 'array',   items: { type: 'string' } },
        typically_served: { type: 'array',   items: { type: 'string', enum: ['breakfast', 'lunch', 'snack', 'dinner'] } },
        notes:            { type: 'string' },
        critical_notes:   { type: 'string',  description: 'Allergy or key preparation warnings — always shown in red' },
        image_url:        { type: 'string',  description: 'Direct URL to a dish image (optional)' },
      },
      required: ['name', 'category'],
    },
  },
  {
    name: 'get_todos',
    description: 'Get to-do items, optionally filtered',
    input_schema: {
      type: 'object' as const,
      properties: {
        date:         { type: 'string',  description: 'Filter by date YYYY-MM-DD (optional)' },
        assignee:     { type: 'string',  enum: TODO_ASSIGNEES.map(a => a.value) },
        include_done: { type: 'boolean', description: 'Include completed todos (default false)' },
      },
    },
  },
  {
    name: 'create_todo',
    description: 'Add a new to-do item',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:    { type: 'string' },
        date:     { type: 'string',  description: 'Due date YYYY-MM-DD (optional)' },
        assignee: { type: 'string',  enum: TODO_ASSIGNEES.map(a => a.value) },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_todo',
    description: 'Mark a todo done/undone, update its title, reassign it, or change its date',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:       { type: 'string' },
        done:     { type: 'boolean' },
        title:    { type: 'string' },
        assignee: { type: 'string', enum: TODO_ASSIGNEES.map(a => a.value) },
        date:     { type: 'string', description: 'YYYY-MM-DD, or null to make it undated' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_todo',
    description: 'Permanently delete a to-do item',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_schedule',
    description: 'Get calendar events for a date or range',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_from:   { type: 'string', description: 'Start date YYYY-MM-DD' },
        date_to:     { type: 'string', description: 'End date YYYY-MM-DD (optional)' },
        participant: { type: 'string', description: `Filter by participant ID (optional). Valid values: ${PARTICIPANTS.map(p => p.value).join(', ')}` },
      },
      required: ['date_from'],
    },
  },
  {
    name: 'create_event',
    description: 'Add a calendar event. If the user gives a specific time, use YYYY-MM-DDTHH:MM format for start/end and set all_day to false. If no time is given, use YYYY-MM-DD and set all_day to true.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:        { type: 'string' },
        type:         { type: 'string', enum: ['school-holiday', 'public-holiday', 'class', 'activity', 'travel', 'appointment'] },
        start:        { type: 'string', description: 'YYYY-MM-DD for all-day events, YYYY-MM-DDTHH:MM for timed events (e.g. 2026-03-18T19:00)' },
        end:          { type: 'string', description: 'YYYY-MM-DD or YYYY-MM-DDTHH:MM. For timed events, always include an end time.' },
        all_day:      { type: 'boolean', description: 'Set to false when a specific time is given, true for all-day events' },
        participants: { type: 'array', items: { type: 'string' } },
        location:     { type: 'string' },
        notes:        { type: 'string' },
      },
      required: ['title', 'type', 'start', 'all_day'],
    },
  },
  {
    name: 'update_event',
    description: 'Edit a calendar event. If updating time, use YYYY-MM-DDTHH:MM format and ensure all_day is false.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:           { type: 'string', description: 'Event _id — strip _YYYY-MM-DD suffix if present' },
        title:        { type: 'string' },
        start:        { type: 'string', description: 'YYYY-MM-DD or YYYY-MM-DDTHH:MM' },
        end:          { type: 'string', description: 'YYYY-MM-DD or YYYY-MM-DDTHH:MM' },
        all_day:      { type: 'boolean' },
        participants: { type: 'array', items: { type: 'string' } },
        location:     { type: 'string' },
        notes:        { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_event',
    description: 'Delete a calendar event',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Event _id — strip _YYYY-MM-DD suffix if present' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_links',
    description: 'List useful links, optionally filtered by category',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', enum: LINK_CATEGORIES.map(c => c.value) },
      },
    },
  },
  {
    name: 'create_link',
    description: 'Add a useful link',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', enum: LINK_CATEGORIES.map(c => c.value) },
        title:    { type: 'string' },
        url:      { type: 'string' },
        notes:    { type: 'string' },
      },
      required: ['category', 'title', 'url'],
    },
  },
  {
    name: 'search_web',
    description: 'Search the web. Use to find recipe pages, images, or any information not in the app.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_dish_info',
    description: 'Fetch and extract dish/recipe information from a URL. Returns name, ingredients, recipe steps, and image_url.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL of a recipe or food page' },
      },
      required: ['url'],
    },
  },
  ...(ENABLE_GO_HOME ? [{
    name: 'get_go_home',
    description: `Compute how ${SCHOOL_CHILD} gets home from school on a given date, using the same logic as the dashboard. Returns: pickup, bus-3pm, bus-4pm, or null (weekend / holiday / no school).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Date YYYY-MM-DD' },
      },
      required: ['date'],
    },
  }] : []),
]

// ─── Tool executor ────────────────────────────────────────────────────────────
async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  await connectDB()

  switch (name) {
    case 'get_meal_plan': {
      const dateTo = (input.date_to as string) ?? (input.date_from as string)
      const entries = await MealPlan.find({
        date: { $gte: input.date_from as string, $lte: dateTo },
      }).sort({ date: 1, slot: 1 }).lean()
      const dishIds = [...new Set(entries.map(e => e.dish_id))]
      const dishes = await Dish.find({ _id: { $in: dishIds } }).select('name name_zh').lean()
      const dishMap = new Map(dishes.map(d => [d._id.toString(), d]))
      return entries.map(e => ({
        _id: e._id, date: e.date, slot: e.slot, who_for: e.who_for,
        dish: dishMap.get(e.dish_id) ?? { name: '(unknown)' },
      }))
    }

    case 'search_dishes': {
      const filter: Record<string, unknown> = { status: { $ne: 'pending' } }
      if (input.query)          filter.name = { $regex: input.query, $options: 'i' }
      if (input.category)       filter.category = input.category
      if (input.tag)            filter.tags = input.tag
      if (input.available_only) filter.available = true
      return Dish.find(filter).select('_id name name_zh category tags typically_served available critical_notes').lean()
    }

    case 'add_meal_to_plan':
      return MealPlan.create({ date: input.date, slot: input.slot, dish_id: input.dish_id, eaters: input.eaters })

    case 'remove_meal_from_plan':
      await MealPlan.findByIdAndDelete(input.entry_id)
      return { ok: true }

    case 'update_dish': {
      const { id, ...fields } = input as { id: string; [key: string]: unknown }
      const updated = await Dish.findByIdAndUpdate(id, { $set: fields }, { new: true })
        .select('_id name notes critical_notes tags available typically_served').lean()
      if (!updated) return { error: 'Dish not found' }
      return updated
    }

    case 'create_dish':
      return Dish.create({ ...input, status: 'pending', source: 'agent' })

    case 'get_todos': {
      const filter: Record<string, unknown> = {}
      if (!input.include_done)  filter.done = false
      if (input.date)           filter.date = input.date
      if (input.assignee)       filter.assignee = input.assignee
      return TodoItem.find(filter).sort({ date: 1, createdAt: 1 }).lean()
    }

    case 'create_todo':
      return TodoItem.create({ title: input.title, date: input.date, assignee: input.assignee, source: 'agent' })

    case 'update_todo': {
      const patch: Record<string, unknown> = {}
      if (input.title    !== undefined) patch.title    = input.title
      if (input.assignee !== undefined) patch.assignee = input.assignee
      if (input.date     !== undefined) patch.date     = input.date
      if (input.done     !== undefined) { patch.done = input.done; patch.doneAt = input.done ? new Date() : null }
      return TodoItem.findByIdAndUpdate(input.id, { $set: patch }, { new: true }).lean()
    }

    case 'delete_todo':
      await TodoItem.findByIdAndDelete(input.id)
      return { ok: true }

    case 'get_schedule': {
      const dateFrom = input.date_from as string
      const dateTo   = (input.date_to as string) ?? dateFrom
      const baseFilter: Record<string, unknown> = {
        $or: [
          // Non-recurring events that fall within the range
          { start: { $gte: dateFrom, $lte: dateTo + 'T23:59' }, 'recurrence.frequency': { $exists: false } },
          // Recurring events whose series overlaps the range
          { 'recurrence.frequency': { $exists: true }, start: { $lte: dateTo + 'T23:59' }, 'recurrence.until': { $gte: dateFrom } },
        ],
      }
      if (input.participant) baseFilter.participants = input.participant
      return ScheduleEvent.find(baseFilter).sort({ start: 1 }).lean()
    }

    case 'create_event':
      return ScheduleEvent.create({ ...input, source: 'agent' })

    case 'update_event': {
      const id = (input.id as string).split('_')[0]
      const { id: _id, ...patch } = input
      return ScheduleEvent.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean()
    }

    case 'delete_event':
      await ScheduleEvent.findByIdAndDelete((input.id as string).split('_')[0])
      return { ok: true }

    case 'get_links': {
      const filter = input.category ? { category: input.category } : {}
      return LinkModel.find(filter).sort({ category: 1, order: 1 }).lean()
    }

    case 'create_link':
      return LinkModel.create(input)

    case 'search_web': {
      const TAVILY_KEY = process.env.TAVILY_API_KEY
      if (!TAVILY_KEY) return { error: 'Web search is not configured (TAVILY_API_KEY missing)' }
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TAVILY_KEY}` },
        body: JSON.stringify({ query: input.query, search_depth: 'basic', include_images: true, max_results: 5 }),
      })
      const data = await res.json()
      return {
        results: (data.results ?? []).map((r: { title: string; url: string; content: string }) => ({
          title: r.title, url: r.url, snippet: r.content,
        })),
        images: data.images ?? [],
      }
    }

    case 'fetch_dish_info':
      return fetchRecipeFromUrl(input.url as string)

    case 'get_go_home': {
      const allEvents = await ScheduleEvent.find().lean()
      const setting = await Settings.findOne({ key: 'go-home' }).lean() as { value?: Record<string, string> } | null
      const defaults: Record<number, HomeMethod> = setting?.value
        ? Object.fromEntries(Object.entries(setting.value).map(([k, v]) => [Number(k), v as HomeMethod]))
        : FALLBACK_HOME_DEFAULTS
      const result = computeHomeMethod(allEvents, input.date as string, defaults)
      const labels: Record<string, string> = { pickup: 'Pickup', 'bus-3pm': 'School bus (3pm)', 'bus-4pm': 'School bus (4pm)' }
      return {
        date: input.date,
        method: result,
        label: result ? labels[result] : null,
        description: result === null
          ? 'No school (weekend or holiday)'
          : labels[result],
      }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { messages, model = 'claude-sonnet-4-6' } = await request.json()

  const todayDatetime = new Date().toLocaleString('en-HK', {
    timeZone: TIMEZONE, dateStyle: 'full', timeStyle: 'short',
  })
  const systemPrompt = SYSTEM_PROMPT.replace('{TODAY_DATETIME}', todayDatetime)

  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  function send(data: object) {
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  ;(async () => {
    try {
      let anthropicMessages: Anthropic.MessageParam[] = messages.map(
        (m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })
      )

      // Multi-turn loop to handle tool use
      while (true) {
        const stream = anthropic.messages.stream({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          tools: TOOLS,
          messages: anthropicMessages,
        })

        stream.on('text', text => send({ type: 'text', text }))

        const finalMsg = await stream.finalMessage()

        if (finalMsg.stop_reason === 'end_turn') break

        const toolUseBlocks = finalMsg.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
        if (toolUseBlocks.length === 0) break

        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const tool of toolUseBlocks) {
          send({ type: 'tool_start', name: tool.name })
          try {
            const result = await executeTool(tool.name, tool.input as Record<string, unknown>)
            toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: JSON.stringify(result) })
          } catch (err) {
            toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: `Error: ${err}`, is_error: true })
          }
          send({ type: 'tool_done', name: tool.name })
        }

        anthropicMessages = [
          ...anthropicMessages,
          { role: 'assistant', content: finalMsg.content },
          { role: 'user',      content: toolResults },
        ]
      }

      send({ type: 'done' })
    } catch (err) {
      send({ type: 'error', message: String(err) })
    } finally {
      writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
