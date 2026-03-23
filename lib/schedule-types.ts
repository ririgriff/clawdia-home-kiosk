export type EventType =
  | 'school-holiday'
  | 'public-holiday'
  | 'class'
  | 'activity'
  | 'travel'
  | 'appointment'

import type { Participant } from '@/config/family'
export type { Participant }

export const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'school-holiday', label: 'School Holiday' },
  { value: 'public-holiday', label: 'Public Holiday' },
  { value: 'class',          label: 'Class' },
  { value: 'activity',       label: 'Activity' },
  { value: 'travel',         label: 'Travel' },
  { value: 'appointment',    label: 'Appointment' },
]

export { PARTICIPANTS } from '@/config/family'

export const EVENT_TYPE_COLORS: Record<EventType, { bg: string; text: string; border: string }> = {
  'school-holiday': { bg: 'rgba(147,51,234,0.22)',  text: '#7c3aed', border: 'rgba(124,58,237,0.45)'  },
  'public-holiday': { bg: 'rgba(244,63,94,0.22)',   text: '#e11d48', border: 'rgba(225,29,72,0.45)'   },
  'class':          { bg: 'rgba(37,99,235,0.22)',   text: '#1d4ed8', border: 'rgba(29,78,216,0.45)'   },
  'activity':       { bg: 'rgba(13,148,136,0.22)',  text: '#0f766e', border: 'rgba(15,118,110,0.45)'  },
  'travel':         { bg: 'rgba(217,119,6,0.22)',   text: '#b45309', border: 'rgba(180,83,9,0.45)'    },
  'appointment':    { bg: 'rgba(236,72,153,0.22)',  text: '#be185d', border: 'rgba(190,24,93,0.45)'   },
}

export interface IScheduleEvent {
  _id: string
  title: string
  type: EventType
  participants: Participant[]
  start: string        // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  end?: string
  all_day: boolean
  recurrence?: {
    frequency: 'weekly'
    days: number[]     // 0=Sun … 6=Sat
    until: string      // YYYY-MM-DD
  }
  location?: string
  travel_type?: 'work' | 'family'
  origin?: string
  destination?: string
  notes?: string
  exceptions?: string[]  // YYYY-MM-DD dates to skip for recurring events
  source?: 'manual' | 'import' | 'agent' | 'ics-feed'
  external_uid?: string
  createdAt?: string
}
