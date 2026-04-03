---
title: Component C — Session Store
type: component
tags:
  - architecture/services
  - status/active
related_to: "[[node-b]]"
---

# Component C — Session Store

The session store holds active user sessions. It references [[node-a]] for gateway
context, creating a deliberate cycle in the graph (A→C→A).

Designed to test cycle detection in graph traversal.
