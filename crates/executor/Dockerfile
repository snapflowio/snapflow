# syntax=docker/dockerfile:1.4

FROM rust:1.94.0-bookworm AS chef
RUN cargo install --locked cargo-chef
WORKDIR /build

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS node-builder
COPY --from=planner /build/recipe.json recipe.json
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/build/target \
    cargo chef cook --release --recipe-path recipe.json -p node
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/build/target \
    cargo build --release -p node && \
    cp /build/target/release/node /build/node-binary

FROM chef AS builder
COPY --from=planner /build/recipe.json recipe.json
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/build/target \
    cargo chef cook --release --recipe-path recipe.json -p executor
COPY . .
COPY --from=node-builder /build/node-binary ./crates/executor/src/node/static/snapflow-amd64
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/build/target \
    cargo build --release -p executor && \
    cp /build/target/release/executor /build/executor-binary

FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fuse \
    libfuse2 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://s3.amazonaws.com/mountpoint-s3-release/latest/x86_64/mount-s3.deb -o mount-s3.deb \
    && dpkg -i mount-s3.deb \
    && rm mount-s3.deb

WORKDIR /app

COPY --from=builder /build/executor-binary ./executor

RUN mkdir -p /app/logs

EXPOSE 8083

ENV TZ=UTC

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
    CMD curl -f http://localhost:8083/ || exit 1

ENTRYPOINT ["./executor"]
