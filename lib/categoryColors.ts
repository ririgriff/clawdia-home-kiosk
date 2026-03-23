// Runtime color map — populated from /api/taxonomy on first fetch.
// Falls back to static defaults for any category not yet in the map.

const colorMap: Record<string, string> = {
  breakfast:    'bg-orange-100 text-orange-800',
  soup:         'bg-blue-100 text-blue-800',
  'main-protein': 'bg-red-100 text-red-800',
  vegetable:    'bg-green-100 text-green-800',
  egg:          'bg-yellow-100 text-yellow-800',
  carb:         'bg-amber-100 text-amber-800',
  'cold-dish':  'bg-cyan-100 text-cyan-800',
  snack:        'bg-purple-100 text-purple-800',
  fruit:        'bg-lime-100 text-lime-800',
  dessert:      'bg-pink-100 text-pink-800',
  drink:        'bg-teal-100 text-teal-800',
}

export function updateCategoryColors(items: { value: string; color: string }[]) {
  for (const item of items) {
    if (item.color) colorMap[item.value] = item.color
  }
}

export function getCategoryColor(category: string): string {
  return colorMap[category] ?? 'bg-gray-100 text-gray-700'
}
