import { computeHomeMethod, HomeMethod } from '@/lib/home-method'
import type { IScheduleEvent } from '@/lib/schedule-types'
import type { Participant } from '@/config/family'

// ── helpers ───────────────────────────────────────────────────────────────────

const CHILD_ID = 'child1'

/** Wraps computeHomeMethod with the test child ID so individual tests stay clean. */
const compute = (
  events: IScheduleEvent[],
  dateStr: string,
  defaults: Record<number, HomeMethod> = DEFAULTS,
) => computeHomeMethod(events, dateStr, defaults, CHILD_ID)

/** A minimal timed event for the school child on dateStr */
function childEvent(dateStr: string, startTime: string, endTime: string, overrides: Partial<IScheduleEvent> = {}): IScheduleEvent {
  return {
    _id: 'evt1',
    title: 'School',
    type: 'class',
    participants: [CHILD_ID] as unknown as Participant[],
    start: `${dateStr}T${startTime}`,
    end: `${dateStr}T${endTime}`,
    all_day: false,
    ...overrides,
  }
}

function holiday(type: 'school-holiday' | 'public-holiday', start: string, end: string): IScheduleEvent {
  return {
    _id: 'hol1',
    title: 'Holiday',
    type,
    participants: ['family'],
    start,
    end,
    all_day: true,
  }
}

const DEFAULTS: Record<number, HomeMethod> = {
  1: 'pickup',   // Monday
  2: 'bus-3pm',  // Tuesday
  3: 'pickup',   // Wednesday
  4: 'bus-3pm',  // Thursday
  5: 'bus-3pm',  // Friday
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('computeHomeMethod', () => {
  // ── Weekends ──────────────────────────────────────────────────────────────

  test('returns null on Saturday', () => {
    expect(compute([], '2026-03-21')).toBeNull() // Saturday
  })

  test('returns null on Sunday', () => {
    expect(compute([], '2026-03-22')).toBeNull() // Sunday
  })

  // ── Holidays ──────────────────────────────────────────────────────────────

  test('returns null on a single-day school holiday', () => {
    const events = [holiday('school-holiday', '2026-03-20', '2026-03-20')]
    expect(compute(events, '2026-03-20')).toBeNull() // Friday
  })

  test('returns null on a single-day public holiday', () => {
    const events = [holiday('public-holiday', '2026-03-19', '2026-03-19')]
    expect(compute(events, '2026-03-19')).toBeNull() // Thursday
  })

  test('returns null when date falls within a multi-day holiday', () => {
    const events = [holiday('school-holiday', '2026-03-16', '2026-03-20')]
    expect(compute(events, '2026-03-18')).toBeNull() // Wednesday in range
  })

  test('does not suppress result for date just outside holiday range', () => {
    const events = [
      holiday('school-holiday', '2026-03-16', '2026-03-20'),
      childEvent('2026-03-23', '08:00', '15:00'),
    ]
    // Monday 23 Mar is outside the holiday — should return pickup (Monday default)
    expect(compute(events, '2026-03-23')).toBe('pickup')
  })

  // ── No school events → null ───────────────────────────────────────────────

  test('returns null on a weekday with no child events', () => {
    expect(compute([], '2026-03-19')).toBeNull() // Thursday
  })

  test('ignores all-day child events when determining school', () => {
    const events: IScheduleEvent[] = [{
      _id: 'allday1', title: 'Birthday', type: 'activity',
      participants: [CHILD_ID] as unknown as Participant[], start: '2026-03-19', all_day: true,
    }]
    expect(compute(events, '2026-03-19')).toBeNull()
  })

  test('ignores child events starting at or after 17:30', () => {
    const events = [childEvent('2026-03-19', '18:00', '19:00')]
    expect(compute(events, '2026-03-19')).toBeNull()
  })

  test('includes child events starting before 17:30', () => {
    const events = [childEvent('2026-03-19', '17:29', '18:30')]
    // ends 18:30 > 16:10 → pickup
    expect(compute(events, '2026-03-19')).toBe('pickup')
  })

  // ── Appointment → pickup ──────────────────────────────────────────────────

  test('returns pickup when child has an appointment', () => {
    const events = [childEvent('2026-03-19', '10:00', '11:00', { type: 'appointment' })]
    expect(compute(events, '2026-03-19')).toBe('pickup')
  })

  test('does not force pickup for non-child appointment', () => {
    const events: IScheduleEvent[] = [
      { _id: 'a1', title: 'Bob appt', type: 'appointment', participants: ['bob'] as unknown as Participant[],
        start: '2026-03-19T10:00', end: '2026-03-19T11:00', all_day: false },
      childEvent('2026-03-19', '08:30', '15:00'),
    ]
    // child ends at 15:00, which is before 15:10 → falls to default (Thursday = bus-3pm)
    expect(compute(events, '2026-03-19')).toBe('bus-3pm')
  })

  // ── Time thresholds ───────────────────────────────────────────────────────

  test('returns pickup when latest child event ends after 16:10', () => {
    const events = [childEvent('2026-03-19', '08:30', '16:11')]
    expect(compute(events, '2026-03-19')).toBe('pickup')
  })

  test('returns pickup when latest child event ends exactly at 16:11', () => {
    const events = [childEvent('2026-03-19', '08:30', '16:11')]
    expect(compute(events, '2026-03-19')).toBe('pickup')
  })

  test('does not return pickup when event ends at exactly 16:10', () => {
    const events = [childEvent('2026-03-19', '08:30', '16:10')]
    // 16:10 is not > 16:10, so falls to next check
    expect(compute(events, '2026-03-19')).toBe('bus-4pm')
  })

  test('returns bus-4pm when latest child event ends after 15:10 but not after 16:10', () => {
    const events = [childEvent('2026-03-19', '08:30', '15:30')]
    expect(compute(events, '2026-03-19')).toBe('bus-4pm')
  })

  test('returns bus-4pm when event ends at exactly 15:11', () => {
    const events = [childEvent('2026-03-19', '08:30', '15:11')]
    expect(compute(events, '2026-03-19')).toBe('bus-4pm')
  })

  test('does not return bus-4pm when event ends at exactly 15:10', () => {
    const events = [childEvent('2026-03-19', '08:30', '15:10')]
    // Thursday default = bus-3pm
    expect(compute(events, '2026-03-19')).toBe('bus-3pm')
  })

  test('falls back to per-day default when event ends before 15:10', () => {
    const events = [childEvent('2026-03-19', '08:30', '15:00')]
    expect(compute(events, '2026-03-19')).toBe('bus-3pm') // Thursday
  })

  test('uses Monday default when event ends before 15:10 on a Monday', () => {
    const events = [childEvent('2026-03-23', '08:30', '15:00')]
    expect(compute(events, '2026-03-23')).toBe('pickup') // Monday
  })

  // ── Multiple events — latest end time wins ────────────────────────────────

  test('uses the latest end time across multiple child events', () => {
    const events = [
      childEvent('2026-03-19', '08:30', '15:00'),
      childEvent('2026-03-19', '14:00', '16:30', { _id: 'evt2' }),
    ]
    // latest is 16:30 > 16:10 → pickup
    expect(compute(events, '2026-03-19')).toBe('pickup')
  })

  // ── Default fallback ──────────────────────────────────────────────────────

  test('falls back to bus-3pm when no default is provided for the day', () => {
    const events = [childEvent('2026-03-19', '08:30', '15:00')]
    expect(compute(events, '2026-03-19', {})).toBe('bus-3pm')
  })
})
