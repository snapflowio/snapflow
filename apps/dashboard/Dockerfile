# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# syntax=docker/dockerfile:1.7

FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS builder

WORKDIR /build

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
ENV CI=true
ENV pnpm_config_verify_deps_before_run=false

RUN npm install -g corepack@0.36.0 && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json biome.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY libs/api-client/package.json libs/api-client/package.json
COPY libs/consent/package.json libs/consent/package.json
COPY libs/contracts/package.json libs/contracts/package.json
COPY libs/organization-access/package.json libs/organization-access/package.json
COPY libs/sdk-typescript/package.json libs/sdk-typescript/package.json
COPY libs/toolbox-api-client/package.json libs/toolbox-api-client/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
	pnpm install --filter @snapflow/dashboard... --frozen-lockfile --ignore-scripts \
	&& pnpm rebuild esbuild

COPY apps/dashboard apps/dashboard
COPY libs/api-client libs/api-client
COPY libs/consent libs/consent
COPY libs/contracts libs/contracts
COPY libs/organization-access libs/organization-access
COPY libs/sdk-typescript libs/sdk-typescript
COPY libs/toolbox-api-client libs/toolbox-api-client

ARG SNAPFLOW_RELEASE_VERSION=development
ARG SNAPFLOW_SOURCE_REVISION=unknown

RUN pnpm --filter @snapflow/dashboard exec vite build \
	&& printf '{"application":"dashboard","release":"%s","revision":"%s"}\n' \
		"$SNAPFLOW_RELEASE_VERSION" "$SNAPFLOW_SOURCE_REVISION" \
		> dist/apps/dashboard/version.json \
	&& node apps/dashboard/scripts/render-nginx-config.ts \
		dist/apps/dashboard/200.html \
		apps/dashboard/nginx.conf \
		/build/nginx.conf

FROM cgr.dev/chainguard/nginx:latest@sha256:7f1cc53f9c57ecfd182fa7a266f6178c5ba4b0a826421b87a753021db7d3d430 AS runtime

COPY --from=builder /build/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /build/dist/apps/dashboard/ /srv/snapflow/

USER 65532

EXPOSE 8080
