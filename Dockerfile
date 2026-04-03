# syntax=docker/dockerfile:1.4

# --- Stage 1: Build Rust binaries ---
FROM rust:bookworm AS rust-builder

WORKDIR /build

COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
COPY clients/ clients/

RUN cargo build --workspace --release

# --- Stage 2: Build web frontend ---
FROM oven/bun:1.3.11-alpine AS web-builder

WORKDIR /build

COPY package.json bun.lock ./
COPY web/ web/
COPY clients/api-client-ts/ clients/api-client-ts/
COPY clients/toolbox-client-ts/ clients/toolbox-client-ts/
COPY sdk/ sdk/
COPY tsconfig.base.json biome.json ./

RUN bun install --frozen-lockfile
RUN cd web && bun run build

# --- Stage 3: Production image ---
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=rust-builder /build/target/release/api dist/bin/api
COPY --from=rust-builder /build/target/release/executor dist/bin/executor
COPY --from=rust-builder /build/target/release/node dist/bin/node
COPY --from=rust-builder /build/target/release/proxy dist/bin/proxy
COPY --from=web-builder /build/dist/web dist/web/

EXPOSE 8081

ENV TZ=UTC

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
    CMD curl -f http://localhost:8081/api/health || exit 1

CMD ["./dist/bin/api"]
