import mongoose, { Schema } from 'mongoose'

const RateLimitSchema = new Schema(
  {
    ip:          { type: String, required: true, unique: true },
    attempts:    { type: Number, default: 0 },
    lockedUntil: { type: Date },
  },
  { timestamps: true }
)

// Auto-delete stale records 1 hour after last update
RateLimitSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 3600 })

export const RateLimit =
  mongoose.models.RateLimit || mongoose.model('RateLimit', RateLimitSchema)
