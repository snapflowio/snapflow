# CLAUDE.md

Guidelines for Claude Code (`claude.ai/code`) when contributing to this repository.

---

## Snapflow – Cloud Development Environment Platform

Snapflow is a multi-service platform for cloud-based development environments. It provides Docker container orchestration, file management, and real-time collaboration.

---

## Architecture Overview

**Monorepo Structure (Turbo Workspace):**

- `apps/api/` – NestJS REST API (TypeScript/Node.js)
- `apps/website/` – Next.js frontend (React/TypeScript)
- `apps/executor/` – Go microservice for container lifecycle management
- `apps/node/` – Go service for in-container tools (filesystem, terminal, LSP)
- `apps/proxy/` – Go proxy for routing and authentication
- `packages/` – Shared libraries and generated API clients

**Core Services:**

- **API Service** – Users, organizations, sandboxes, images, billing
- **Executor Service** – Container lifecycle, image builds, resource allocation
- **Node Service** – In-container terminal, LSP, file operations, Git integration
- **Proxy Service** – Routing, authentication, load balancing
- **Website** – Dashboard UI, marketing, account management

---

## Essential Commands

**Development:**

```bash
pnpm format              # Format all code
pnpm lint:fix            # Lint and fix issues
pnpm build:development   # Build services (development)
pnpm build:production    # Build services (production)
pnpm preview             # Preview services

cd apps/api && pnpm serve      # Run API locally
cd apps/website && pnpm dev    # Run website locally

turbo test --filter=@snapflow/executor   # Run Go service tests (executor, node, proxy)
```

**Database:**

```bash
pnpm db:generate           # Generate TypeORM migration
pnpm db:push               # Apply pending migrations
pnpm db:generate-production  # Production only (not for development)
pnpm db:push-production
```

**API Clients:**

```bash
pnpm generate:api-client   # Generate OpenAPI specs and clients
```

---

## Core Workflow

**Always begin with:** _“Let me research the codebase and create a plan before implementing.”_

1. **Research** – Study patterns and architecture.
2. **Plan** – Propose approach, confirm before coding.
3. **Implement** – Build with tests, error handling.
4. **Validate** – Run formatters, linters, and tests.
5. **Exmplain** – What did you do? Give a list.

---

## Key Technologies

**API (NestJS):**

- TypeORM + PostgreSQL
- JWT & API Key authentication
- Swagger/OpenAPI docs
- Redis for caching & realtime
- Event-driven with `@nestjs/event-emitter`

**Frontend (Next.js):**

- React + TypeScript
- Tailwind CSS with custom UI
- Auth0 integration
- WebSockets for realtime updates
- ContentLayer (MDX) for content

**Go Services:**

- Docker API integration
- SSH/terminal proxy
- LSP integration
- Filesystem + Git tools

**Build System:**

- Turbo monorepo for task orchestration
- Biome for formatting & linting
- Auto-generated API clients (TS & Go)
- Docker multi-stage builds

---

## Code Patterns & Conventions

**NestJS API:**

- Domain-driven modules (`organization/`, `sandbox/`, `user/`)
- DTOs for validation
- Guards for auth & permissions
- Decorators (`@AuthContext`, `@RequiredRole`)
- Event subscribers for cross-domain logic

**Entity Relationships:**

- Orgs → users, sandboxes, images
- Role-based, org-scoped permissions
- Sandbox lifecycle: `created → starting → running → stopping → stopped`
- Image builds tracked + executor assignment

**Go Services:**

- Echo v4 HTTP framework
- Structured logs & errors
- Docker client abstraction
- Env-based configuration

---

## Architecture Principles

- **Always a feature branch:** remove old code completely. No deprecation, versioned names, or “removed code” comments.
- **Prefer explicit over implicit:** clear names, obvious data flow, direct dependencies.

---

## Development Guidelines

**Efficiency:**

- Run searches/greps in parallel.
- Use multiple agents for large tasks.
- Batch related edits.

**TypeScript Standards:**

- Use explicit types (never `any`).
- Prefer async/await over `.then()`.
- Early returns to avoid nesting.
- Delete old code instead of versioning.
- Table-driven tests for multiple inputs/outputs.
- JSDoc/TSDoc for all exports.
- Keep `.module.ts` files structured for DI.
- Run migrations after entity changes.

**Go Standards:**

- Use concrete types, not `interface{}`.
- Prefer channels over `time.Sleep()`.
- Early returns for readability.
- Preserve error chains: `fmt.Errorf("context: %w", err)`
- Use table tests for complex logic.
- Godoc all exported symbols.

---

## Problem-Solving Approach

- **Stuck?** Stop. The simplest solution is usually correct.
- **Uncertain?** “Let me ultrathink about this architecture.”
- **Choosing between options?** Present tradeoffs: _“A (simple) vs B (flexible)”_.

---

## Testing Strategy

- **UI / simple features:** no tests needed.
- **Complex logic:** TDD.
- **CRUD:** code first, add tests later.
- **Hot paths:** add benchmarks.

**Security:** always validate inputs, use `crypto/rand`, use prepared SQL.\
**Performance:** measure before optimizing.

---

## Progress Tracking

- Use **TodoWrite** for tasks.
- Favor clear names over clever abstractions.
