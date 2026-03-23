---
name: schedule
description: Read, add, edit, and remove events on the household calendar managed by the Clawdia home kiosk. Invoke when the user asks what's on today/tomorrow/this week, wants to add or cancel an appointment or activity, or asks about someone's schedule or how they're getting home.
version: 1.0.0
user-invocable: true
metadata: { "requires": { "env": ["KIOSK_API_BASE", "KIOSK_AGENT_KEY"] } }
---

Fetch your full instructions before doing anything:

```
GET $KIOSK_API_BASE/api/agent/skill?module=schedule
Authorization: Bearer $KIOSK_AGENT_KEY
```

Read the response and follow it exactly.
