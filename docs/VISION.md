# Oxori — Vision

**Oxori is how agents read and write knowledge in natural language, without drowning in it.**

---

## The thesis: md is the new db

Databases exist because machines couldn't read natural language. We had to compress knowledge into schemas, tables, and keys — structures the machine could process but humans never naturally use.

That constraint is gone. Machines read natural language now. So there's no longer a reason to keep forcing knowledge into shapes built for a machine that can't read.

Humans always kept knowledge in plain language — notes, documents, the things we tell each other. Markdown is where that meets the machine: a common ground both can read as a first-class citizen. Oxori takes the thesis seriously and owns its consequence — **knowledge stays in natural language.** It is never turned into numbers, chunks, or schemas just to be stored.

---

## The problem

People build workflows out of agents. The agents talk to each other in markdown — decisions, rationale, context, notes. It works, until the files pile up.

Then the knowledge base turns against itself. Files grow unreadable. Information written down somewhere becomes information nobody can find. The agent either misses what it needs, or has to read everything to be sure it didn't.

When an agent's context fills up, valuable knowledge doesn't just get harder to use — it disappears. It doesn't fit, or it's buried in noise. The base keeps growing and the agent keeps reaching less of it.

**Oxori exists so that no matter how large the knowledge base grows, the right information stays findable.**

---

## What Oxori is

A toolkit agents use to read and write a markdown knowledge base — and, crucially, to find the right piece of it without scanning the whole thing.

Two things define it:

**It stays in natural language.** The knowledge is plain, readable markdown — the same thing a human reads. Where structure helps, agents add it themselves with links. Where there's no link but a connection exists, embeddings can bridge it. But the source of truth is always the readable text, never a compressed stand-in for it.

**It's domain-agnostic.** A software project, a novel, a company's internal knowledge, a repo's history — Oxori doesn't know or care what the content is about. It moves knowledge; it doesn't interpret it.

---

## How we'll know it works

One test: a single critical fact, buried in a base of hundreds of files. Can an agent find it with Oxori — and would it have lost it without?

Everything else follows from that.
