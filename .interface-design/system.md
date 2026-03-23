# Home Kiosk — Design System
Direction: Kitchen Ledger (warm stone light / cream)
Source: interface-design.dev/showcases/meal-planner.html
Last updated: 2026-03-16

## Palette
Canvas:     #ede9e6  (--parchment)    — pin page bg, deepest ground
Surface-1:  #f5f3f0  (--parchment-2) — main page background
Surface-2:  #ffffff  (--parchment-3) — nav, drawers, modals (elevated white)
Surface-3:  #fafaf9  (--parchment-4) — cards, dish tiles
Input:      #ede9e6  (--parchment-5) — inset inputs (recessed)

Ink:        #1c1917  (--ink)         — primary text
Ink-2:      #44403c  (--ink-2)       — secondary text
Ink-3:      #78716c  (--ink-3)       — muted labels
Ink-4:      #a8a29e  (--ink-4)       — placeholder, disabled

Border:       rgba(28,25,23,0.08)   (--border)
Border-strong: rgba(28,25,23,0.14)  (--border-strong)
Border-dashed: rgba(28,25,23,0.22)  (--border-dashed)

Ember:      #ea580c  (--ember)       — primary action, terracotta
Ember-2:    #c2410c  (--ember-2)     — hover state
Ember-bg:   rgba(234,88,12,0.10)    (--ember-bg)

Sage:       #4a7c6f  (--sage)        — today indicator
Sage-bg:    rgba(74,124,111,0.12)   (--sage-bg)

## Typography
UI text:     Manrope 400/500/600  (--font-sans)
Display:     Fraunces 500         (--font-display) — headings, day numbers, section titles
Mono:        JetBrains Mono       — future use for data

## Spacing
Base unit: 4px
Common: 4, 8, 12, 16, 24, 32, 48

## Depth strategy
Borders-only. rgba borders at 0.08–0.22 opacity.
No shadows except drawer overlay shadow.
Elevation: cream page → white surfaces → bordered cards.

## Border radius
Cards/modals: rounded-xl (12px)
Buttons:      rounded-lg (8px) or rounded-xl (12px) in forms
Chips:        rounded (4px)
Inputs:       rounded-xl (12px)

## Category chip colors (light variants)
soup:         bg-blue-100  text-blue-800
main-protein: bg-red-100   text-red-800
vegetable:    bg-green-100 text-green-800
egg:          bg-yellow-100 text-yellow-800
carb:         bg-amber-100 text-amber-800
cold-dish:    bg-cyan-100  text-cyan-800
snack:        bg-purple-100 text-purple-800
dessert:      bg-pink-100  text-pink-800
drink:        bg-teal-100  text-teal-800

## Signature elements
- Fraunces day numbers in weekly grid
- Dashed borders on empty meal slots (invite to fill)
- 👨‍👩‍👧 / 👧 lane icons for adult/child
- Ember terracotta for all primary actions
- Sage green for today's column
- Slot labels rotated vertically on left rail

## Component patterns
Button primary:   bg ember, text white, rounded-xl
Button secondary: bg parchment-4, border border, text ink-3
Input:            bg parchment-5, border-strong, text ink, rounded-xl
Dish chip:        category color class, rounded, px-1.5 py-0.5, text-xs
Drawer:           fixed bottom, parchment-3 (white), rounded-t-2xl, border-top border-strong
Modal overlay:    bg black/70, z-60; modal z-70
