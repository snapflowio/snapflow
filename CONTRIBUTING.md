# Contributing to Snapflow

Thanks for wanting to contribute to Snapflow. This guide covers what you need to know before opening a pull request.

## Rules to Acknowledge

### 1) All PRs should target our `canary` branch

The `canary` branch is where all new changes land. Open every pull request against `canary`.

### 2) All PRs should follow our PR template

At a minimum, every PR must include:

- A short description of the change
- What was changed and why
- Any problems you ran into

Bullet points are fine.

### 3) Open an issue before submitting a PR

Every PR should link to an existing issue. If there isn't one yet, create it with a description of the problem and your planned approach. This gives maintainers a chance to give feedback early and avoids wasted work on changes that don't fit current goals.

Small fixes like typos and broken links can skip the issue and go straight to a PR.

For bigger changes:

- Open an issue with the problem and your approach
- Open a draft PR early to check direction
- Message a maintainer directly

When in doubt, open an issue.

### 4) Understand the code you submit

You should be able to explain every change in your PR during review. A short summary of what the code does and why it works is enough.

## Project Layout

Snapflow is a Rust and TypeScript monorepo. Learn the structure before making changes:

| Directory | Contents |
|-----------|----------|
| `crates/` | Rust backend services (API, executor, node, proxy, auth, storage, models) |
| `web/` | React frontend built with Vite and TailwindCSS |
| `docs/` | Next.js documentation site |
| `sdk/typescript-sdk/` | TypeScript SDK for the Snapflow API |
| `clients/` | Auto-generated API clients (TypeScript and Rust) from OpenAPI specs |

## Getting Set Up

[`just`](https://github.com/casey/just) is the command runner for the project. Services like PostgreSQL, Redis, and SMTP run through `docker-compose.yml`.

```sh
just install          # Install dependencies (Bun + Cargo)
just dev-api          # Start the API server
just dev-web          # Start the web dev server
just dev-executor     # Start the executor (requires sudo)
just dev-node         # Start the node service
just dev-proxy        # Start the proxy service
just dev-docs         # Start the docs dev server
```

## How to Contribute

1. Fork the repo, or make a branch if you have write access.
2. Start your branch from `canary`.
3. Make your changes.
4. Open a PR into `canary` and describe what you did.
5. Work through any review comments and CI issues.
6. After approval, we'll squash-merge your PR into `canary`.

Try to keep PRs short and focused on one thing. Smaller PRs get reviewed faster.

### How commits work

We squash-merge every PR, so your PR title ends up as the single commit on `canary`. Because of that:

- Your PR title needs to follow Conventional Commits (mostly lowercase).
- Commits inside the PR don't need any special format.

Use whatever commit style you prefer while working. Cleaning up with force-pushes before review is totally fine, just keep things easy for reviewers to read.

## Conventional Commits

Your PR title is the commit message, so it needs to follow this format:

`type(scope optional): short description`

Some examples:

- `fix: handle empty response from api`
- `feat(auth): add passkey login`
- `docs: update setup guide`
- `refactor(node): clean up retry logic`
- `chore(ci): speed up checks`

For breaking changes, add a `!`:

- `feat!: remove legacy auth endpoints`
- `refactor(api)!: change pagination shape`

Types you can use:
`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`

## Tests

Only add tests when they actually help catch bugs. Don't write them just to hit a coverage number.

### Backend (Rust)

Backend changes should have unit tests. You can run them with:

```sh
just test
```

- If you find yourself writing a lot of mocks, that's a sign the code needs to be split up. Redesign it so it's easier to test directly.

### Frontend (React)

We don't expect unit tests for most frontend work. Add them if:

- the code you're touching already has tests, or
- the change is tricky and a test would catch regressions

Otherwise, describe how you tested it in the PR and include screenshots if relevant.

## Formatting and Linting

We use [Biome](https://biomejs.dev/) for TypeScript/JavaScript and [Clippy](https://doc.rust-lang.org/clippy/) + `cargo fmt` for Rust.

```sh
just lint             # Run Clippy + Biome
just fmt              # Format all code
just lint-fix         # Auto-fix what it can
```

Don't worry about getting a clean lint run before opening your PR. CI runs these checks automatically and will tell you what to fix.

## PR Checklist

Make sure these are done before you ask for a review:

- [ ] PR targets `canary`
- [ ] Title follows Conventional Commits (mostly lowercase)
- [ ] Description covers what you changed and why
- [ ] You understand every part of the diff
- [ ] Tests are added or updated if needed
- [ ] CI is passing (or you're actively fixing it)

Nice to have:

- Screenshots or screen recordings for anything visual
- Steps someone else can follow to test your change

## Code of Conduct

By contributing, you agree to follow our [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
