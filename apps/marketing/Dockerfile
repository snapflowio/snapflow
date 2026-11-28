# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# syntax=docker/dockerfile:1.7

FROM --platform=$BUILDPLATFORM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS builder

WORKDIR /build

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
ENV CI=true

RUN npm install -g corepack@0.36.0 && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json biome.json ./
COPY apps/marketing/package.json apps/marketing/package.json
COPY libs/api-client/package.json libs/api-client/package.json
COPY libs/consent/package.json libs/consent/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
	pnpm install --filter @snapflow/marketing... --frozen-lockfile --ignore-scripts \
	&& pnpm rebuild esbuild sharp

COPY libs/api-client libs/api-client
COPY libs/consent libs/consent
COPY apps/marketing apps/marketing

ARG PUBLIC_SITE_URL=https://snapflow.io
ARG SNAPFLOW_RELEASE_VERSION=development
ARG SNAPFLOW_SOURCE_REVISION=unknown

ARG PUBLIC_POSTHOG_PROJECT_KEY=
ARG PUBLIC_POSTHOG_HOST=

ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
ENV PUBLIC_POSTHOG_PROJECT_KEY=$PUBLIC_POSTHOG_PROJECT_KEY
ENV PUBLIC_POSTHOG_HOST=$PUBLIC_POSTHOG_HOST

WORKDIR /build/apps/marketing

RUN ../../node_modules/.bin/astro build \
	&& printf '{"application":"marketing","release":"%s","revision":"%s"}\n' \
		"$SNAPFLOW_RELEASE_VERSION" "$SNAPFLOW_SOURCE_REVISION" \
		> ../../dist/apps/marketing/version.json

FROM cgr.dev/chainguard/nginx:latest@sha256:7f1cc53f9c57ecfd182fa7a266f6178c5ba4b0a826421b87a753021db7d3d430 AS runtime

COPY apps/marketing/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /build/dist/apps/marketing/ /srv/snapflow/

USER 65532

EXPOSE 8080
