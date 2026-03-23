import mongoose, { Schema } from 'mongoose'
import type { IScheduleEvent } from '../schedule-types'

const ScheduleEventSchema = new Schema<IScheduleEvent>(
  {
    title:        { type: String, required: true, trim: true },
    type:         { type: String, required: true, enum: ['school-holiday', 'public-holiday', 'class', 'activity', 'travel', 'appointment'] },
    participants: [{ type: String }],
    start:        { type: String, required: true },
    end:          { type: String },
    all_day:      { type: Boolean, default: true },
    recurrence: {
      frequency: { type: String },
      days:      [{ type: Number }],
      until:     { type: String },
    },
    location:     { type: String },
    travel_type:  { type: String, enum: ['work', 'family'] },
    origin:       { type: String },
    destination:  { type: String },
    exceptions:   [{ type: String }],
    notes:        { type: String },
    source:       { type: String, enum: ['manual', 'import', 'agent', 'ics-feed'], default: 'manual' },
    external_uid: { type: String },
  },
  { timestamps: true }
)

ScheduleEventSchema.index({ start: 1 })
ScheduleEventSchema.index({ type: 1 })
ScheduleEventSchema.index({ external_uid: 1 }, { sparse: true })

export const ScheduleEvent =
  mongoose.models.ScheduleEvent ||
  mongoose.model<IScheduleEvent>('ScheduleEvent', ScheduleEventSchema)
