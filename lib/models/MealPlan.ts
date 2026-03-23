import mongoose, { Schema } from 'mongoose'
import type { IMealPlanEntry } from '../types'

const MealPlanSchema = new Schema<IMealPlanEntry>({
  date: { type: String, required: true },
  slot: { type: String, required: true, enum: ['breakfast', 'lunch', 'snack', 'dinner'] },
  dish_id: { type: String, required: true },
  eaters:  { type: [String], required: true },
  note:    { type: String },
})

MealPlanSchema.index({ date: 1, slot: 1 })

export const MealPlan =
  mongoose.models.MealPlan || mongoose.model<IMealPlanEntry>('MealPlan', MealPlanSchema)
