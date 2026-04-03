---
type: decision
status: open
tags: [auth, security]
depends_on: [[user-model]]
blocks: [[deploy-v2]]
author: agent:researcher
created_at: 2026-04-01T10:00:00Z
---

# Use OAuth2 for API Authentication

We decided to use OAuth2 for the public API because it provides standardized token-based auth.

## Alternatives Considered

- API keys — too simple, no scoping
- SAML — too complex for our use case

Related: [[security-review]]
