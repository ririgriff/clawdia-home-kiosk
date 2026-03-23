import mongoose, { Schema } from 'mongoose'

const SettingsSchema = new Schema(
  {
    key:   { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
)

export const Settings =
  mongoose.models.Settings || mongoose.model('Settings', SettingsSchema)
