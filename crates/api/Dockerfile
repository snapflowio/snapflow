# syntax=docker/dockerfile:1.4

FROM rust:1.94.0-bookworm AS chef
RUN cargo install --locked cargo-chef
WORKDIR /build

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /build/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json -p api
COPY . .
RUN cargo build --release -p api

FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /build/target/release/api ./api

EXPOSE 8081

ENV TZ=UTC

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD curl -f http://localhost:8081/api/health || exit 1

ENTRYPOINT ["./api"]
