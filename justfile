set shell := ["bash", "-uc"]

arch := if arch() == "aarch64" { "aarch64" } else { "x86_64" }
musl_target := arch + "-unknown-linux-musl"
node_static := "crates/executor/src/node/static/snapflow-" + if arch() == "aarch64" { "arm64" } else { "amd64" }

default:
    @just --list --unsorted

# --- Database ---

[group('database')]
db-migrate:
    #!/bin/bash
    set -eua
    source crates/api/.env
    cd crates/api && sqlx migrate run

[group('database')]
[confirm('Revert the last migration?')]
db-revert:
    #!/bin/bash
    set -eua
    source crates/api/.env
    cd crates/api && sqlx migrate revert

[group('database')]
db-status:
    #!/bin/bash
    set -eua
    source crates/api/.env
    cd crates/api && sqlx migrate info

[group('database')]
db-create name:
    cd crates/api && sqlx migrate add {{name}}

[group('database')]
db-prepare:
    #!/bin/bash
    set -eua
    source crates/api/.env
    cd crates/api && cargo sqlx prepare

# --- Build ---

[group('build')]
build-node:
    cargo build -p node --target {{musl_target}}
    cp target/{{musl_target}}/debug/node {{node_static}}

[group('build')]
build-node-release:
    cargo build -p node --target {{musl_target}} --release
    cp target/{{musl_target}}/release/node {{node_static}}

[group('build')]
build: build-node
    cargo build --workspace

[group('build')]
build-release: build-node-release
    cargo build --workspace --release

[group('build')]
build-web:
    #!/bin/bash
    set -eua
    source web/.env
    cd web && bun run build

[group('build')]
build-docs:
    cd docs && bun run build

[group('build')]
build-all: build build-web build-docs

# --- Dist ---

[group('dist')]
dist: dist-clean dist-bin dist-web dist-openapi
    @echo "All artifacts built into dist/"

[group('dist')]
dist-bin: build-release
    mkdir -p dist/bin
    cp target/release/api dist/bin/
    cp target/release/executor dist/bin/
    cp target/{{musl_target}}/release/node dist/bin/
    cp target/release/proxy dist/bin/

[group('dist')]
dist-web: build-web
    @echo "Web built to dist/web/"

[group('dist')]
dist-openapi:
    #!/bin/bash
    set -eua
    mkdir -p dist/openapi
    source crates/api/.env
    cargo run -p api --release -- --openapi > dist/openapi/api.json
    source crates/executor/.env
    cargo run -p executor --release -- --openapi > dist/openapi/executor.json
    cargo run -p node --target {{musl_target}} --release -- --openapi > dist/openapi/node.json

[group('dist')]
dist-clean:
    rm -rf dist/

# --- Dev ---

[group('dev')]
dev-api:
    #!/bin/bash
    set -eua
    source crates/api/.env
    cargo run -p api

[group('dev')]
dev-web:
    #!/bin/bash
    set -eua
    source web/.env
    cd web && bun run dev

[group('dev')]
dev-executor: build-node
    #!/bin/bash
    set -eua
    source crates/executor/.env
    cargo build -p executor
    sudo -E ./target/debug/executor

[group('dev')]
dev-node:
    cargo run -p node

[group('dev')]
dev-proxy:
    #!/bin/bash
    set -eua
    source crates/proxy/.env
    cargo run -p proxy

[group('dev')]
dev-docs:
    cd docs && bun run dev

# --- License ---

[group('quality')]
license-check:
    license-eye -c .licenserc.yaml header check
    license-eye -c .licenserc-clients.yaml header check

[group('quality')]
license-fix:
    license-eye -c .licenserc.yaml header fix
    license-eye -c .licenserc-clients.yaml header fix

# --- Check & Lint ---

[group('quality')]
check:
    cargo check --workspace

[group('quality')]
[no-exit-message]
lint:
    cargo clippy --workspace
    bunx biome check .

[group('quality')]
lint-fix:
    cargo clippy --workspace --fix --allow-dirty
    bunx biome check . --write

[group('quality')]
fmt:
    cargo fmt --all
    bunx biome format . --write

# --- Test ---

[group('test')]
[no-exit-message]
test:
    cargo test --workspace

[group('test')]
[no-exit-message]
test-web:
    #!/bin/bash
    set -eua
    source web/.env
    cd web && bun run test

# --- OpenAPI & Codegen ---

[group('codegen')]
openapi-api:
    #!/bin/bash
    set -eua
    source crates/api/.env
    mkdir -p dist/openapi
    cargo run -p api -- --openapi > dist/openapi/api.json

[group('codegen')]
openapi-executor:
    #!/bin/bash
    set -eua
    source crates/executor/.env
    mkdir -p dist/openapi
    cargo run -p executor -- --openapi > dist/openapi/executor.json

[group('codegen')]
openapi-node:
    mkdir -p dist/openapi
    cargo run -p node -- --openapi > dist/openapi/node.json

[group('codegen')]
generate-api-client-ts: openapi-api
    bunx openapi-generator-cli generate \
        -i dist/openapi/api.json \
        -g typescript-axios \
        --additional-properties=supportsES6=true,withSeparateModelsAndApi=true,apiPackage=api,modelPackage=models,useTags=true,enumPropertyNaming=UPPERCASE,licenseName=Apache-2.0 \
        --type-mappings=DateTime=Date \
        --skip-validate-spec \
        -o clients/api-client-ts/src

[group('codegen')]
generate-toolbox-client-ts: openapi-node
    bunx openapi-generator-cli generate \
        -i dist/openapi/node.json \
        -g typescript-axios \
        --additional-properties=supportsES6=true,withSeparateModelsAndApi=true,apiPackage=api,modelPackage=models,useTags=true,enumPropertyNaming=UPPERCASE,licenseName=Apache-2.0 \
        --type-mappings=DateTime=Date \
        --skip-validate-spec \
        -o clients/toolbox-client-ts/src

[group('codegen')]
generate-api-client-rs: openapi-api
    bunx openapi-generator-cli generate \
        -i dist/openapi/api.json \
        -g rust \
        --additional-properties=packageName=snapflow-api-client,packageVersion=0.1.0,library=reqwest,supportAsync=true,enumClassPrefix=true,licenseName=Apache-2.0 \
        --skip-validate-spec \
        -o clients/api-client-rs

[group('codegen')]
generate-executor-client-rs: openapi-executor
    bunx openapi-generator-cli generate \
        -i dist/openapi/executor.json \
        -g rust \
        --additional-properties=packageName=snapflow-executor-client,packageVersion=0.1.0,library=reqwest,supportAsync=true,enumClassPrefix=true,licenseName=Apache-2.0 \
        --skip-validate-spec \
        -o clients/executor-client-rs

[group('codegen')]
generate-all: generate-api-client-ts generate-toolbox-client-ts generate-api-client-rs generate-executor-client-rs
    just license-fix

# --- Setup ---

[group('setup')]
install:
    bun install
    cargo build --workspace

# --- Maintenance ---

[group('maintenance')]
[confirm('Delete all node_modules and target directories?')]
cleanup:
    bash scripts/cleanup.sh
