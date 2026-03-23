/**
 * Auto-generation of TodoItems from schedule data.
 * Called by the daily cron (/api/cron/todos) for today + tomorrow.
 *
 * Rules are defined in config/family.ts (AUTO_GEN_RULES).
 * The evaluator here interprets those rules — add new condition types here
 * if you extend the rule schema.
 *
 * Dedup: each item has a stable `autoGenKey`. If a record with that key already
 * exists (whether source='auto' or converted to 'manual'), it is skipped —
 * preserving any manual edits and preventing duplicates.
 */

import { connectDB }        from './mongodb'
import { TodoItem }         from './models/TodoItem'
import { ScheduleEvent }    from './models/ScheduleEvent'
import type { IScheduleEvent } from './schedule-types'
import { computeHomeMethod } from './home-method'
import { SCHOOL_CHILD, AUTO_GEN_RULES, ENABLE_GO_HOME } from '@/config/family'
import type { TodoAssignee } from './todo-types'

// ── helpers ──────────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Expand a single recurring event to the instance on dateStr, or null if it
 *  doesn't occur on that date (wrong DOW, outside range, etc.). */
function expandToDate(event: IScheduleEvent, dateStr: string): IScheduleEvent | null {
  if (!event.recurrence?.frequency) return null
  const dow = new Date(dateStr + 'T12:00:00').getDay()
  if (!event.recurrence.days.includes(dow)) return null
  if (event.start.slice(0, 10) > dateStr)   return null
  if (event.recurrence.until < dateStr)      return null
  const timeStart = event.start.length > 10 ? event.start.slice(10) : ''
  const timeEnd   = event.end && event.end.length > 10 ? event.end.slice(10) : ''
  return {
    ...event,
    _id:   `${event._id}_${dateStr}`,
    start: dateStr + timeStart,
    end:   event.end ? (dateStr + timeEnd) : undefined,
  }
}

/**
 * Fetch all events relevant to dateStr and return a combined list of:
 *  - raw non-recurring events that overlap the date (for multi-day holiday detection)
 *  - expanded recurring instances that fall on dateStr
 *
 * This mirrors the query logic in /api/schedule so computeHomeMethod works correctly.
 */
async function fetchEventsForDate(dateStr: string): Promise<IScheduleEvent[]> {
  const docs = await ScheduleEvent.find({
    start: { $lte: dateStr + 'T23:59' },
    $or: [
      { end: { $gte: dateStr } },
      { end: { $exists: false } },
      { end: null },
      { 'recurrence.frequency': { $exists: true } },
    ],
  }).lean() as unknown as IScheduleEvent[]

  const result: IScheduleEvent[] = []
  for (const doc of docs) {
    if (doc.recurrence?.frequency) {
      const instance = expandToDate(doc, dateStr)
      if (instance) result.push(instance)
    } else {
      result.push({ ...doc, _id: doc._id.toString() })
    }
  }
  return result
}

// ── auto-item computation ────────────────────────────────────────────────────

interface PendingItem {
  title:      string
  date:       string
  assignee?:  TodoAssignee
  autoGenKey: string
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

async function computeAutoItems(dateStr: string): Promise<PendingItem[]> {
  const events = await fetchEventsForDate(dateStr)
  const items: PendingItem[] = []

  const method = computeHomeMethod(events, dateStr, undefined, SCHOOL_CHILD)
  const dow    = new Date(dateStr + 'T12:00:00').getDay()

  for (const rule of AUTO_GEN_RULES) {
    const { condition } = rule

    if (condition.type === 'go_home_pickup') {
      if (ENABLE_GO_HOME && method === 'pickup') {
        items.push({
          title:      applyTemplate(rule.title, { schoolChild: SCHOOL_CHILD }),
          date:       dateStr,
          assignee:   rule.assignee,
          autoGenKey: `${rule.autoGenKey}-${dateStr}`,
        })
      }

    } else if (condition.type === 'appointment_for_school_child') {
      if (!ENABLE_GO_HOME) continue
      const appointments = events.filter(
        e => e.type === 'appointment' && e.participants?.includes(SCHOOL_CHILD) && e.start.slice(0, 10) === dateStr,
      )
      for (const appt of appointments) {
        const baseId = appt._id.toString().split('_')[0]
        items.push({
          title:      applyTemplate(rule.title, { schoolChild: SCHOOL_CHILD, appointmentTitle: appt.title }),
          date:       dateStr,
          assignee:   rule.assignee,
          autoGenKey: `${rule.autoGenKey}-${baseId}-${dateStr}`,
        })
      }

    } else if (condition.type === 'day_of_week') {
      if (condition.days.includes(dow)) {
        items.push({
          title:      applyTemplate(rule.title, { schoolChild: SCHOOL_CHILD }),
          date:       dateStr,
          assignee:   rule.assignee,
          autoGenKey: `${rule.autoGenKey}-${dateStr}`,
        })
      }

    } else if (condition.type === 'day_of_month') {
      const dom = new Date(dateStr + 'T12:00:00').getDate()
      if (condition.days.includes(dom)) {
        items.push({
          title:      applyTemplate(rule.title, { schoolChild: SCHOOL_CHILD }),
          date:       dateStr,
          assignee:   rule.assignee,
          autoGenKey: `${rule.autoGenKey}-${dateStr}`,
        })
      }

    } else if (condition.type === 'nth_weekday_of_month') {
      const date = new Date(dateStr + 'T12:00:00')
      if (date.getDay() !== condition.weekday) continue
      const dom = date.getDate()
      const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
      const occurrence = condition.n > 0
        ? Math.ceil(dom / 7)                                    // 1st, 2nd, 3rd…
        : Math.floor((daysInMonth - dom) / 7) + 1              // 1=last, 2=second-to-last…
      if (occurrence !== Math.abs(condition.n)) continue
      items.push({
        title:      applyTemplate(rule.title, { schoolChild: SCHOOL_CHILD }),
        date:       dateStr,
        assignee:   rule.assignee,
        autoGenKey: `${rule.autoGenKey}-${dateStr}`,
      })

    } else if (condition.type === 'days_before_event') {
      const target = new Date(dateStr + 'T12:00:00')
      target.setDate(target.getDate() + condition.days)
      const targetStr = toDateString(target)
      const futureEvents = await fetchEventsForDate(targetStr)
      const matching = futureEvents.filter(e => {
        if (condition.eventType && e.type !== condition.eventType) return false
        if (condition.participant && !(e.participants as string[]).includes(condition.participant)) return false
        return true
      })
      for (const evt of matching) {
        const baseId = evt._id.toString().split('_')[0]
        items.push({
          title:      applyTemplate(rule.title, { schoolChild: SCHOOL_CHILD, eventTitle: evt.title, eventDate: targetStr }),
          date:       dateStr,
          assignee:   rule.assignee,
          autoGenKey: `${rule.autoGenKey}-${baseId}-${dateStr}`,
        })
      }
    }
  }

  return items
}

// ── public API ───────────────────────────────────────────────────────────────

export async function generateTodosForDate(
  dateStr: string,
): Promise<{ created: number; skipped: number }> {
  await connectDB()
  const autoItems = await computeAutoItems(dateStr)
  let created = 0
  let skipped = 0
  for (const item of autoItems) {
    const existing = await TodoItem.findOne({ autoGenKey: item.autoGenKey })
    if (existing) { skipped++; continue }
    await TodoItem.create({ ...item, source: 'auto', done: false })
    created++
  }
  return { created, skipped }
}
