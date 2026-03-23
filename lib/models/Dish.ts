import mongoose, { Schema } from 'mongoose'
import type { IDish } from '../types'
import { MEAL_MEMBERS } from '@/config/family'

const DishSchema = new Schema<IDish>(
  {
    name: { type: String, required: true, trim: true },
    name_zh: { type: String, trim: true },
    category: [{ type: String, required: true }],
    tags: [{ type: String }],
    notes: { type: String },
    who_for: { type: String, enum: ['adult', 'child', 'both'], default: 'both' },
    image_url: { type: String },
    recipe: { type: String },
    critical_notes: { type: String },
    ingredients: [
      {
        name: { type: String, required: true },
        quantity: { type: String, default: '' },
        unit: { type: String, default: '' },
        photo_url: { type: String },
        critical_notes: { type: String },
        purchase_link: { type: String },
      },
    ],
    reference_url: { type: String },
    typically_served: [{ type: String, enum: ['breakfast', 'lunch', 'snack', 'dinner'] }],
    available:  { type: Boolean, default: true },
    requested:  { type: Boolean, default: false },
    favorites:  { type: [{ type: String }], default: () => MEAL_MEMBERS.map(m => m.id) },
    status:     { type: String, enum: ['active', 'pending'], default: 'active' },
    source:     { type: String, enum: ['manual', 'agent'], default: 'manual' },
  },
  { timestamps: true }
)

DishSchema.index({ status: 1, name: 1 })

export const Dish = mongoose.models.Dish || mongoose.model<IDish>('Dish', DishSchema)
