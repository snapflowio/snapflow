# syntax=docker/dockerfile:1.4

FROM rust:1.94.0-bookworm AS chef
RUN cargo install --locked cargo-chef
WORKDIR /build

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /build/recipe.json recipe.json
RUN --mount=type=cache,sharing=locked,target=/usr/local/cargo/registry \
    --mount=type=cache,sharing=locked,target=/usr/local/cargo/git \
    --mount=type=cache,id=api-target,target=/build/target \
    cargo chef cook --release --recipe-path recipe.json -p api
COPY . .
RUN --mount=type=cache,sharing=locked,target=/usr/local/cargo/registry \
    --mount=type=cache,sharing=locked,target=/usr/local/cargo/git \
    --mount=type=cache,id=api-target,target=/build/target \
    cargo build --release -p api && \
    cp /build/target/release/api /build/api-binary

FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /build/api-binary ./api

EXPOSE 8081

ENV TZ=UTC

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD curl -f http://localhost:8081/api/health || exit 1

ENTRYPOINT ["./api"]
