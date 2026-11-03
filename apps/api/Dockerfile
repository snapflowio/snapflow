# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# syntax=docker/dockerfile:1.7

FROM node:22.23.1-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS workspace

ENV CI=true
ENV pnpm_config_verify_deps_before_run=false
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY libs/machine-proto/package.json libs/machine-proto/package.json
COPY libs/organization-access/package.json libs/organization-access/package.json
COPY libs/toolbox-api-client/package.json libs/toolbox-api-client/package.json

FROM workspace AS production-dependencies

RUN --mount=type=cache,id=snapflow-pnpm-store,target=/pnpm/store \
	pnpm --filter @snapflow/api deploy --prod --frozen-lockfile --ignore-scripts \
		--config.inject-workspace-packages=true /deploy

FROM workspace AS build

RUN --mount=type=cache,id=snapflow-pnpm-store,target=/pnpm/store \
	pnpm install --frozen-lockfile --ignore-scripts --filter @snapflow/api...

COPY scripts/build-provenance.mts scripts/build-provenance.mts
COPY libs/organization-access libs/organization-access
COPY libs/machine-proto libs/machine-proto
COPY libs/toolbox-api-client libs/toolbox-api-client
COPY apps/api apps/api

ARG SNAPFLOW_RELEASE_VERSION
ARG SNAPFLOW_SOURCE_REVISION

RUN if [ -z "$SNAPFLOW_RELEASE_VERSION" ] || [ "$SNAPFLOW_RELEASE_VERSION" = development ]; then \
		echo "SNAPFLOW_RELEASE_VERSION must name the release this image is built for" >&2; \
		exit 1; \
	fi \
	&& if [ -z "$SNAPFLOW_SOURCE_REVISION" ]; then \
		echo "SNAPFLOW_SOURCE_REVISION must name the commit this image is built from" >&2; \
		exit 1; \
	fi \
	&& pnpm --filter @snapflow/api build:production

FROM golang:1.27.3-bookworm@sha256:d9b6a1beb9474adc2a1ce842573639b44b2a0dd49b6669f51d3821baf9ec37c9 AS machine-benchmark

WORKDIR /src
COPY apps/snapflow ./apps/snapflow
COPY libs/api-client-go ./libs/api-client-go
COPY libs/common-go ./libs/common-go
COPY libs/machine-proto ./libs/machine-proto
COPY libs/microvm-go ./libs/microvm-go
COPY libs/tunnel-go ./libs/tunnel-go

RUN --mount=type=cache,target=/root/.cache/go-build \
	for target_arch in amd64 arm64; do \
		CGO_ENABLED=0 GOOS=linux GOARCH="${target_arch}" go build \
			-C apps/snapflow -trimpath -ldflags="-s -w" \
			-o "/out/linux/${target_arch}/machine-benchmark" ./cmd/machine-benchmark; \
	done

FROM node:22.23.1-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS geoip-database

COPY scripts/download-geoip-database.sh /usr/local/bin/download-geoip-database

RUN download-geoip-database /opt/snapflow/geoip/dbip-city-lite.mmdb

FROM node:22.23.1-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runtime

ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app

RUN apk upgrade --no-cache \
	&& apk add --no-cache ca-certificates \
	&& rm -rf /var/cache/apk/*

COPY --chown=root:root apps/api/package.json ./package.json
COPY --chown=root:root --from=production-dependencies /deploy/node_modules ./node_modules
COPY --chown=root:root --from=build /workspace/dist/apps/api ./dist/apps/api
COPY --chown=root:root --from=machine-benchmark /out ./dist/apps/machine-benchmark
COPY --chown=root:root --from=geoip-database /opt/snapflow/geoip /opt/snapflow/geoip

USER 1000:1000

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=60s --retries=3 \
	CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/health`).then((response) => process.exit(response.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "dist/apps/api/main.mjs"]
