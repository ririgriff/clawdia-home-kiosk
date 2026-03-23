---
name: meal-planner
description: Add dishes to the meal database on the Clawdia home kiosk, generate dish ideas, and summarise the meal plan for a given day. Invoke when the user mentions food, meals, dishes, recipes, or asks what's planned for a day.
version: 1.0.0
user-invocable: true
metadata: { "requires": { "env": ["KIOSK_API_BASE", "KIOSK_AGENT_KEY"] } }
---

Fetch your full instructions before doing anything:

```
GET $KIOSK_API_BASE/api/agent/skill
Authorization: Bearer $KIOSK_AGENT_KEY
```

Read the response and follow it exactly.
