---
title: Component E — Load Balancer
type: component
tags:
  - architecture/gateway
  - status/active
---

# Component E — Load Balancer

The load balancer distributes traffic. As a hub node it connects to both [[node-a]]
(the API gateway) and [[node-d]] (the database layer directly for health checks).

Used to test hub node detection — high in-degree and out-degree.
