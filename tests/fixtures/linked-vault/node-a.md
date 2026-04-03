---
title: Component A — API Gateway
type: component
tags:
  - architecture/services
  - status/stable
implements: "[[node-d]]"
---

# Component A — API Gateway

The API gateway is the entry point for all external traffic. It routes to [[node-b]]
for authentication and [[node-c]] for session management.

All requests flow through this component first.
