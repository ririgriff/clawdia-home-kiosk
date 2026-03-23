export type DishCategory =
  | 'breakfast'
  | 'soup'
  | 'main-protein'
  | 'vegetable'
  | 'egg'
  | 'carb'
  | 'cold-dish'
  | 'snack'
  | 'fruit'
  | 'dessert'
  | 'drink'

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner'
export type WhoFor = 'adult' | 'child' | 'both'

export const DISH_CATEGORIES: { value: DishCategory; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'soup', label: 'Soup' },
  { value: 'main-protein', label: 'Main Protein' },
  { value: 'vegetable', label: 'Vegetable' },
  { value: 'egg', label: 'Egg Dish' },
  { value: 'carb', label: 'Carb / Staple' },
  { value: 'cold-dish', label: 'Cold Dish' },
  { value: 'snack', label: 'Snack' },
  { value: 'fruit', label: 'Fruit' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'drink', label: 'Drink' },
]

export const DISH_TAGS = [
  'beef', 'pork', 'chicken', 'fish', 'seafood', 'tofu',
  'quick', 'slow-cook', 'adult',
  'western', 'chinese', 'thai', 'japanese',
]

export const MEAL_SLOTS: { value: MealSlot; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'snack', label: 'Snack' },
  { value: 'dinner', label: 'Dinner' },
]

export const CATEGORY_COLORS: Record<DishCategory, string> = {
  breakfast: 'bg-orange-100 text-orange-800',
  soup: 'bg-blue-100 text-blue-800',
  'main-protein': 'bg-red-100 text-red-800',
  vegetable: 'bg-green-100 text-green-800',
  egg: 'bg-yellow-100 text-yellow-800',
  carb: 'bg-amber-100 text-amber-800',
  'cold-dish': 'bg-cyan-100 text-cyan-800',
  snack: 'bg-purple-100 text-purple-800',
  fruit: 'bg-lime-100 text-lime-800',
  dessert: 'bg-pink-100 text-pink-800',
  drink: 'bg-teal-100 text-teal-800',
}

export interface Ingredient {
  name: string
  quantity: string
  unit: string
  photo_url?: string
  critical_notes?: string
  purchase_link?: string
}

export interface IDish {
  _id: string
  name: string
  name_zh?: string
  category: DishCategory[]
  tags: string[]
  notes?: string
  critical_notes?: string
  who_for: WhoFor
  image_url?: string
  recipe?: string
  ingredients?: Ingredient[]
  reference_url?: string
  typically_served?: MealSlot[]
  available?: boolean
  requested?: boolean
  favorites?: string[]
  status?: 'active' | 'pending'
  source?: 'manual' | 'agent'
  createdAt?: string
}

export type LinkCategory = 'kids' | 'food' | 'other'

export const LINK_CATEGORIES: { value: LinkCategory; label: string }[] = [
  { value: 'kids',  label: 'School & Activities' },
  { value: 'food',  label: 'Food Shopping' },
  { value: 'other', label: 'Others' },
]

export interface ILink {
  _id: string
  category: LinkCategory
  title: string
  url: string
  notes?: string
  order: number
}

export interface IMealPlanEntry {
  _id: string
  date: string
  slot: MealSlot
  dish_id: string
  dish?: IDish
  /** Member IDs of who is eating this meal entry. */
  eaters: string[]
  /** Optional note for this specific meal plan instance (e.g. prep instructions). */
  note?: string
}
