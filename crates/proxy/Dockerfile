# syntax=docker/dockerfile:1.4
FROM rust:1.94.0-bookworm AS chef
RUN cargo install --locked cargo-chef
WORKDIR /build

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /build/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json -p proxy

COPY . .
RUN cargo build --release -p proxy

FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /build/target/release/proxy ./proxy

EXPOSE 4000
ENV TZ=UTC

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
    CMD curl -f http://localhost:4000/health || exit 1

ENTRYPOINT ["./proxy"]