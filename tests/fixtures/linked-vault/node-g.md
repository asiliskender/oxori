---
title: Component G — Metrics Exporter
type: component
tags:
  - architecture/observability
implements: "[[node-d]]"
---

# Component G — Metrics Exporter

The metrics exporter reads counters from [[node-d]] (the database layer) and exports
them to the observability platform.

A simple leaf-adjacent node: one outgoing link, one typed relation.
