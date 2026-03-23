import type { IScheduleEvent } from './schedule-types'
import {
  SCHOOL_CHILD,
  GO_HOME_PICKUP_AFTER,
  GO_HOME_BUS_LATE_AFTER,
  FALLBACK_HOME_DEFAULTS,
  type Participant,
} from '@/config/family'

export type HomeMethod = 'bus-3pm' | 'bus-4pm' | 'pickup'

// Re-export so existing importers (components, API routes) don't break.
export { FALLBACK_HOME_DEFAULTS }

/**
 * Determine how the school child gets home on a given date.
 *
 * Pass the full events array returned by the API (not pre-filtered by date)
 * so that multi-day holiday events are correctly detected.
 *
 * Returns null on weekends or school/public holidays.
 *
 * Precedence:
 *  1. Weekend              → null
 *  2. School/public holiday that covers dateStr → null
 *  3. Appointment for school child → 'pickup'  (needs adult)
 *  4. Latest school-child event ends after GO_HOME_PICKUP_AFTER  → 'pickup'
 *  5. Latest school-child event ends after GO_HOME_BUS_LATE_AFTER → 'bus-4pm'
 *  6. Otherwise                          → stored default for that weekday
 */
export function computeHomeMethod(
  allEvents: IScheduleEvent[],
  dateStr: string,
  defaults: Record<number, HomeMethod> = FALLBACK_HOME_DEFAULTS,
  schoolChild: string = SCHOOL_CHILD,
): HomeMethod | null {
  const dow = new Date(dateStr + 'T12:00:00').getDay() // 0=Sun … 6=Sat

  if (dow === 0 || dow === 6) return null

  // Check if dateStr falls within any school or public holiday (multi-day aware)
  const hasHoliday = allEvents.some(e => {
    if (e.type !== 'school-holiday' && e.type !== 'public-holiday') return false
    const start = e.start.slice(0, 10)
    const end   = e.end?.slice(0, 10) ?? start
    return dateStr >= start && dateStr <= end
  })
  if (hasHoliday) return null

  // Timed events for the school child that start on this date before 17:30.
  // Events starting at or after 17:30 are evening home activities and do not
  // affect how the child gets home from school.
  const childEvents = allEvents.filter(e => {
    if (!e.participants?.includes(schoolChild as Participant) || e.all_day) return false
    if (e.start.slice(0, 10) !== dateStr) return false
    const startTime = e.start.length > 10 ? e.start.slice(11, 16) : '00:00'
    return startTime < '17:30'
  })

  // No school events for the child → treat as no school
  if (childEvents.length === 0) return null

  // Appointment → needs adult accompaniment → pickup
  if (childEvents.some(e => e.type === 'appointment')) return 'pickup'

  // Find the latest end time across all the child's events
  let latestEnd = '00:00'
  for (const e of childEvents) {
    const endTime = e.end ? e.end.slice(11, 16) : e.start.slice(11, 16)
    if (endTime > latestEnd) latestEnd = endTime
  }

  if (latestEnd > GO_HOME_PICKUP_AFTER)   return 'pickup'
  if (latestEnd > GO_HOME_BUS_LATE_AFTER) return 'bus-4pm'
  return defaults[dow] ?? 'bus-3pm'
}
