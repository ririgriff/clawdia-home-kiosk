import { NextRequest, NextResponse } from 'next/server'
import { DISH_CATEGORIES, DISH_TAGS } from '@/lib/types'
import { PARTICIPANTS, MEAL_MEMBERS, MEAL_SHORTCUTS } from '@/config/family'

function verifyAgent(req: NextRequest): boolean {
  const key = process.env.AGENT_API_KEY
  if (!key) return false
  return req.headers.get('authorization') === `Bearer ${key}`
}

export async function GET(req: NextRequest) {
  if (!verifyAgent(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    taxonomy: {
      categories: DISH_CATEGORIES.map(c => ({ value: c.value, label: c.label })),
      tags: DISH_TAGS,
      eaters: MEAL_MEMBERS.map(m => m.id),
    },
    fields: {
      required: ['name', 'category'],
      optional: ['name_zh', 'tags', 'notes', 'recipe', 'ingredients', 'reference_url'],
      notes: {
        name: 'English dish name (string)',
        name_zh: 'Chinese dish name (string, optional)',
        category: 'Array of category values — must use values from taxonomy.categories',
        tags: 'Array of tag strings — should use values from taxonomy.tags where possible',
        recipe: 'Free-text cooking instructions (string)',
        ingredients: 'Array of { name, quantity, unit }',
        reference_url: 'Source URL for the recipe (string)',
      },
    },
    endpoints: {
      meals: {
        'GET /api/agent/schema': 'Returns this document — fetch at startup to get current taxonomy and rules',
        'GET /api/agent/dishes': 'List all active (approved) dishes — use to check what already exists before submitting',
        'POST /api/agent/dishes': 'Submit a dish — always lands as pending for human review before going live',
        'GET /api/agent/mealplan?date=YYYY-MM-DD': 'Get the meal plan for a specific day grouped by slot — each entry includes an id field',
        'GET /api/agent/mealplan?weekStart=YYYY-MM-DD': 'Get the full week meal plan (7 days) starting from the given Monday',
        'POST /api/agent/mealplan': 'Add a dish to the meal plan',
        'PUT /api/agent/mealplan?id=ENTRY_ID': 'Update eaters or note on a meal plan entry',
        'DELETE /api/agent/mealplan?id=ENTRY_ID': 'Remove a dish from the meal plan',
        'GET /api/agent/skill?module=meals': 'Full skill prompt for meal planning workflows',
      },
      schedule: {
        'GET /api/agent/schedule?date=YYYY-MM-DD': 'Get all events for a specific date (recurring events expanded)',
        'GET /api/agent/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD': 'Get all events in a date range',
        'POST /api/agent/schedule': 'Create a new event',
        'PUT /api/agent/schedule?id=EVENT_ID': 'Update an event by ID (use full recurring-instance ID)',
        'DELETE /api/agent/schedule?id=EVENT_ID': 'Delete an event by ID',
        'GET /api/agent/skill?module=schedule': 'Full skill prompt for schedule workflows',
      },
    },
    schedule: {
      types: ['class', 'activity', 'appointment', 'travel', 'school-holiday', 'public-holiday'],
      participants: PARTICIPANTS.map(p => p.value),
      date_formats: {
        all_day: 'YYYY-MM-DD',
        timed: 'YYYY-MM-DDTHH:mm',
      },
      recurrence: {
        note: 'Weekly recurrence only',
        fields: { frequency: 'weekly', days: '0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat', until: 'YYYY-MM-DD' },
      },
      recurring_id_format: '<mongoId>_YYYY-MM-DD — editing or deleting affects the whole series',
    },
    rules: [
      'Always use category and tag values from taxonomy — do not invent new ones',
      'category is an array — a dish can belong to multiple categories',
      'Check existing dishes before submitting to avoid duplicates',
      'All submitted dishes are pending until a human approves them in the app — tell the user this',
      `Meal plan eaters: array of member IDs. Available: ${MEAL_MEMBERS.map(m => m.id).join(', ')}. Shortcuts: ${MEAL_SHORTCUTS.map(s => `"${s.label}" = [${s.members.join(', ')}]`).join(', ')}`,
      'Schedule: always confirm add/edit/delete with the user before submitting',
      'Schedule: warn user when editing or deleting a recurring event (affects entire series)',
    ],
  })
}
