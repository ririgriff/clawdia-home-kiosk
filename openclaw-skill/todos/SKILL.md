---
name: kiosk-todos
description: View, add, complete, reassign, and delete household to-do items on the Clawdia home kiosk. Invoke when the user mentions tasks, chores, reminders, or to-dos for the household.
version: 1.0.0
user-invocable: true
metadata: { "requires": { "env": ["KIOSK_API_BASE", "KIOSK_AGENT_KEY"] } }
---

Fetch your full instructions before doing anything:

```
GET $KIOSK_API_BASE/api/agent/skill?module=todos
Authorization: Bearer $KIOSK_AGENT_KEY
```

Read the response and follow it exactly.
