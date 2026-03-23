import { IScheduleEvent, EVENT_TYPE_COLORS, PARTICIPANTS } from '@/lib/schedule-types'

interface Props {
  event: IScheduleEvent
  onClick: () => void
  style?: React.CSSProperties
  compact?: boolean
}

const FLIGHT_COLORS = { bg: 'rgba(14,165,233,0.22)', text: '#0369a1', border: 'rgba(3,105,161,0.45)' }

export default function EventChip({ event, onClick, style, compact }: Props) {
  const colors = event.source === 'ics-feed' ? FLIGHT_COLORS : EVENT_TYPE_COLORS[event.type]
  const participantLabels = event.participants
    .map(p => PARTICIPANTS.find(x => x.value === p)?.label ?? p)
    .join(', ')

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg px-2 py-1 transition-opacity hover:opacity-80"
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        fontSize: compact ? 11 : 12,
        lineHeight: 1.3,
        ...style,
      }}
    >
      <span className="font-medium block">{event.title}</span>
      {!compact && participantLabels && (
        <span className="block" style={{ opacity: 0.75, fontSize: 10 }}>{participantLabels}</span>
      )}
      {!compact && event.location && (
        <span className="block" style={{ opacity: 0.65, fontSize: 10 }}>{event.location}</span>
      )}
    </button>
  )
}
