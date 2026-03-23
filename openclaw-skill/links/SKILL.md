---
name: links
description: View, add, update, and delete useful links saved on the Clawdia home kiosk. Invoke when the user asks about saved websites, shopping links, school links, or wants to add/remove a URL.
version: 1.0.0
user-invocable: true
metadata: { "requires": { "env": ["KIOSK_API_BASE", "KIOSK_AGENT_KEY"] } }
---

Fetch your full instructions before doing anything:

```
GET $KIOSK_API_BASE/api/agent/skill?module=links
Authorization: Bearer $KIOSK_AGENT_KEY
```

Read the response and follow it exactly.
