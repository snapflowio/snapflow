# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# syntax=docker/dockerfile:1.7

FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS builder

WORKDIR /build

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
ENV CI=true
ENV pnpm_config_verify_deps_before_run=false

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json biome.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY libs/api-client/package.json libs/api-client/package.json
COPY libs/organization-access/package.json libs/organization-access/package.json
COPY libs/toolbox-api-client/package.json libs/toolbox-api-client/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
	pnpm install --filter @snapflow/dashboard... --frozen-lockfile --ignore-scripts \
	&& pnpm rebuild esbuild

COPY apps/dashboard apps/dashboard
COPY libs/api-client libs/api-client
COPY libs/organization-access libs/organization-access
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

# Chainguard's nginx is rebuilt daily from patched sources and has no shell.
# It runs as its nonroot user; the site and config stay root-owned and
# read-only, and nginx writes only to /tmp.
FROM cgr.dev/chainguard/nginx:latest@sha256:b9debc2fbe5bf256b4c3980d0bbfda8187d46e35b4117c582ace66269dc1de28 AS runtime

COPY --from=builder /build/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /build/dist/apps/dashboard/ /srv/snapflow/

EXPOSE 8080
