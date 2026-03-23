import mongoose, { Schema } from 'mongoose'
import { TODO_ASSIGNEES } from '@/config/family'

const TodoItemSchema = new Schema(
  {
    title:      { type: String, required: true },
    date:       { type: String },                              // YYYY-MM-DD, optional
    assignee:   { type: String, enum: TODO_ASSIGNEES.map(a => a.value) },
    done:       { type: Boolean, default: false },
    doneAt:     { type: Date },
    source:     { type: String, enum: ['manual', 'agent', 'auto'], default: 'manual' },
    /** Unique key for auto-gen dedup. sparse so multiple manual items can have no key. */
    autoGenKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
)

TodoItemSchema.index({ date: 1, createdAt: 1 })
TodoItemSchema.index({ done: 1, doneAt: 1 })

export const TodoItem =
  mongoose.models.TodoItem || mongoose.model('TodoItem', TodoItemSchema)
