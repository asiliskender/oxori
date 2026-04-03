---
title: Component B — Auth Module
type: component
tags:
  - architecture/auth
  - status/stable
depends_on: "[[node-a]]"
---

# Component B — Auth Module

The authentication module validates all incoming requests. It depends on [[node-c]]
for session validation and writes tokens to [[node-d]] (the datastore).

This module is downstream of node-a.
