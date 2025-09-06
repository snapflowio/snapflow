# CLAUDE.md

Guidelines for Claude Code (`claude.ai/code`) when contributing to this repository.

---

## Project – Student Productivity & Social Platform

A gamified student productivity and social networking platform built with modern web technologies, featuring workspace management, social interactions, achievement systems, and collaborative study tools.

---

## Architecture Overview

**Monorepo Structure (Nx Workspace):**

- `apps/api/` – NestJS REST API (TypeScript/Node.js)
- `apps/website/` – React SPA with TanStack Router (React/TypeScript/Vite)
- `packages/` – Shared libraries and generated API clients
- `examples/` – Example implementations and demos

**Core Services:**

- **API Service** – Users, workspaces, authentication, gamification, social features, analytics
- **Website** – Student dashboard, social feeds, study tools, achievement tracking, profile management

---

## Essential Commands

**Development:**

```bash
bun format              # Format all code with Biome
bun lint:check          # Apply linting fixes with Biome
bun build               # Build all services (development)
bun build:production    # Build all services (production)
bun serve               # Run all services locally
bun serve:production    # Run services in production mode

nx serve api            # Run API service only
nx dev website          # Run website with dev server
```

**Database (Drizzle ORM):**

```bash
bun migration:generate  # Generate new migration
bun migration:run       # Apply pending migrations
bun db:studio          # Open Drizzle Studio
```

**API Clients:**

```bash
bun generate:api-client   # Generate OpenAPI specs and clients
```

---

## Core Workflow

**Always begin with:** _"Let me research the codebase and understand the requirements."_

1. **Research** – Study existing patterns and architecture
2. **Plan** – Create todo list and confirm approach
3. **Implement** – Build incrementally with error handling
4. **Validate** – Test functionality (no auto-linting after every change)
5. **Final Check** – Run format/lint only at completion if needed

---

## Key Technologies

**API (NestJS):**

- Drizzle ORM + PostgreSQL
- Better Auth for authentication
- Swagger/OpenAPI documentation
- Redis for caching & realtime
- Event-driven with `@nestjs/event-emitter`
- Dockerode for container management

**Frontend (React SPA):**

- React 19 + TypeScript
- TanStack Router for routing
- Tailwind CSS v4 + Radix UI
- Better Auth client integration
- Vite for build tooling
- Real-time updates via Socket.io

**Build System:**

- Nx monorepo for task orchestration
- Biome for formatting & linting
- Bun package manager
- Auto-generated API clients (TypeScript)
- Vite/Webpack for bundling

---

## Code Patterns & Conventions

**NestJS API:**

- Domain-driven modules (`user/`, `workspace/`, `auth/`, `analytics/`)
- DTOs for validation with class-validator
- Guards for authentication & workspace access
- Decorators (`@Session`, `@WorkspaceContext`, `@RequiredWorkspaceMemberRole`)
- Event-driven architecture with subscribers
- Repository pattern with Drizzle ORM

**Entity Relationships:**

- Workspaces → users, invitations
- Role-based workspace permissions (owner, admin, member)
- User authentication via Better Auth
- Event sourcing for workspace activities

**Frontend (React):**

- TanStack Router file-based routing
- Custom hooks for API integration
- Context providers for global state
- Radix UI components with Tailwind styling
- Form validation with React Hook Form

---

## Architecture Principles

- **Always a feature branch:** remove old code completely. No deprecation, versioned names, or “removed code” comments.
- **Prefer explicit over implicit:** clear names, obvious data flow, direct dependencies.

---

## Development Guidelines

**Efficiency:**

- Run searches/greps in parallel
- Use TodoWrite for task management
- Batch related edits together
- **No auto-linting** after every small change

**TypeScript Standards:**

- Use explicit types (avoid `any`)
- Prefer async/await over `.then()`
- Early returns to reduce nesting
- Remove old code completely, no deprecation comments
- Table-driven tests for complex logic
- JSDoc/TSDoc for exported functions
- Keep `.module.ts` files clean for dependency injection
- Run migrations after schema changes

**React/Frontend:**

- Use TanStack Query for data fetching
- Implement proper error boundaries
- Leverage Suspense for loading states
- Custom hooks for reusable logic
- Proper TypeScript interfaces for API responses

---

## Problem-Solving Approach

- **Stuck?** Step back. The simplest solution is usually correct
- **Uncertain?** Research existing patterns in the codebase first
- **Multiple options?** Present tradeoffs: _"A (simple) vs B (flexible)"_
- **Large tasks?** Break into smaller, manageable pieces with TodoWrite

---

## Testing Strategy

- **Simple CRUD/UI:** Implement first, test if needed
- **Complex business logic:** Write tests during development
- **API endpoints:** Integration tests for critical paths
- **Validation logic:** Unit tests for edge cases

**Security:** Always validate inputs, use parameterized queries, sanitize outputs  
**Performance:** Profile before optimizing, measure actual bottlenecks

---

## Linting & Formatting

- Use `bun format` and `bun lint:check` only when completing major features
- **Don't run** after every small change - let the developer choose when
- Biome handles both formatting and linting in one tool
- Configuration optimized for React/TypeScript development

---

## Progress Tracking

- **Always use TodoWrite** for multi-step tasks
- Mark tasks as completed immediately after finishing
- Clear, specific task descriptions
- Break complex features into smaller actionable items
