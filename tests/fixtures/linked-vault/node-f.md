---
title: Component F — Notification Service
type: component
tags:
  - architecture/services
related_to:
  - "[[node-e]]"
  - "[[node-c]]"
---

# Component F — Notification Service

The notification service sits adjacent to the core flow. It calls into [[node-b]]
for auth verification before sending notifications.

This file tests multiple typed-relation targets: `related_to` maps to both
node-e and node-c, exercising the `Map<string, string[]>` shape of typedRelations.
