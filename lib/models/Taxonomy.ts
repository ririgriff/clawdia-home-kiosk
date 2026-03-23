import mongoose, { Schema } from 'mongoose'

export interface ITaxonomyItem {
  _id: string
  type: 'category' | 'tag'
  value: string   // slug, e.g. 'main-protein'
  label: string   // display, e.g. 'Main Protein'
  color: string   // tailwind classes (categories only)
}

const TaxonomySchema = new Schema<ITaxonomyItem>(
  {
    type:  { type: String, enum: ['category', 'tag'], required: true },
    value: { type: String, required: true },
    label: { type: String, required: true },
    color: { type: String, default: '' },
  },
  { timestamps: true }
)

TaxonomySchema.index({ type: 1, value: 1 }, { unique: true })

export const Taxonomy =
  mongoose.models.Taxonomy ||
  mongoose.model<ITaxonomyItem>('Taxonomy', TaxonomySchema)
