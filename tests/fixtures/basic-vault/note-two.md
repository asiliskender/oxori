---
title: Note Two
type: note
depends_on: "[[prerequisite]]"
blocks: "[[note-one]]"
---

# Note Two

This note has typed relations in frontmatter only. The `depends_on` and `blocks`
keys reference other files via wikilinks, making them typed graph edges.

There are intentionally no wikilinks in this body — this lets tests verify that
typed relations (from frontmatter) do NOT bleed into the body wikilinks Set.
