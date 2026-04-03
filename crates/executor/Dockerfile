# syntax=docker/dockerfile:1.4

FROM rust:bookworm AS builder

WORKDIR /build

COPY Cargo.toml Cargo.lock ./

COPY crates/executor/Cargo.toml crates/executor/Cargo.toml
COPY crates/common/Cargo.toml crates/common/Cargo.toml
COPY crates/models/Cargo.toml crates/models/Cargo.toml
COPY crates/errors/Cargo.toml crates/errors/Cargo.toml
COPY crates/storage/Cargo.toml crates/storage/Cargo.toml
COPY crates/auth/Cargo.toml crates/auth/Cargo.toml
COPY clients/api-client-rs/Cargo.toml clients/api-client-rs/Cargo.toml
COPY clients/executor-client-rs/Cargo.toml clients/executor-client-rs/Cargo.toml

RUN mkdir -p crates/executor/src && echo "fn main() {}" > crates/executor/src/main.rs && \
    mkdir -p crates/common/src && echo "" > crates/common/src/lib.rs && \
    mkdir -p crates/models/src && echo "" > crates/models/src/lib.rs && \
    mkdir -p crates/errors/src && echo "" > crates/errors/src/lib.rs && \
    mkdir -p crates/storage/src && echo "" > crates/storage/src/lib.rs && \
    mkdir -p crates/auth/src && echo "" > crates/auth/src/lib.rs && \
    mkdir -p clients/api-client-rs/src && echo "" > clients/api-client-rs/src/lib.rs && \
    mkdir -p clients/executor-client-rs/src && echo "" > clients/executor-client-rs/src/lib.rs

RUN cargo build --release -p executor 2>/dev/null || true

COPY crates/executor/src crates/executor/src
COPY crates/common/src crates/common/src
COPY crates/models/src crates/models/src
COPY crates/errors/src crates/errors/src
COPY crates/storage/src crates/storage/src
COPY crates/auth/src crates/auth/src
COPY clients/api-client-rs/src clients/api-client-rs/src
COPY clients/executor-client-rs/src clients/executor-client-rs/src

RUN touch crates/executor/src/main.rs
RUN cargo build --release -p executor

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://s3.amazonaws.com/mountpoint-s3-release/latest/x86_64/mount-s3.deb -o mount-s3.deb \
    && dpkg -i mount-s3.deb \
    && rm mount-s3.deb

WORKDIR /app

COPY --from=builder /build/target/release/executor dist/bin/executor

RUN mkdir -p /app/logs

EXPOSE 8083

ENV TZ=UTC

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
    CMD curl -f http://localhost:8083/ || exit 1

CMD ["./dist/bin/executor"]
