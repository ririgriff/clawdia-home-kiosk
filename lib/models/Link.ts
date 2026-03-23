import mongoose, { Schema } from 'mongoose'

const LinkSchema = new Schema(
  {
    category: { type: String, required: true },
    title:    { type: String, required: true },
    url:      { type: String, required: true },
    notes:    { type: String },
    order:    { type: Number, default: 0 },
  },
  { timestamps: true },
)

LinkSchema.index({ category: 1, order: 1 })

export const Link =
  mongoose.models.Link || mongoose.model('Link', LinkSchema)
