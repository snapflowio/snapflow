# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# syntax=docker/dockerfile:1.7

FROM --platform=$BUILDPLATFORM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS builder

WORKDIR /build

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
ENV CI=true

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json biome.json ./
COPY apps/marketing/package.json apps/marketing/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
	pnpm install --filter @snapflow/marketing... --frozen-lockfile --ignore-scripts \
	&& pnpm rebuild @parcel/watcher esbuild sharp

COPY apps/marketing apps/marketing

ARG PUBLIC_SITE_URL=https://snapflow.io
ARG SNAPFLOW_RELEASE_VERSION=development
ARG SNAPFLOW_SOURCE_REVISION=unknown

ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL

RUN cd apps/marketing \
	&& ../../node_modules/.bin/astro build \
	&& printf '{"application":"marketing","release":"%s","revision":"%s"}\n' \
		"$SNAPFLOW_RELEASE_VERSION" "$SNAPFLOW_SOURCE_REVISION" \
		> ../../dist/apps/marketing/version.json

FROM cgr.dev/chainguard/static:latest@sha256:fc42af33e643f20d08baf03cddcc1c02ba57052dfb02edb0d79f3fc47bcea8d9 AS runtime

# A shell-less base with only CA certificates; images/caddy (the bake "caddy"
# context) supplies a Caddy built from source with current dependencies. The
# site and Caddyfile stay root-owned, so the server cannot rewrite them.
COPY --from=caddy /caddy /usr/bin/caddy
COPY --from=caddy /mime.types /etc/mime.types
COPY --from=caddy --chown=10001:10001 /writable/ /
COPY --from=builder /build/dist/apps/marketing/ /srv/snapflow/
COPY apps/marketing/Caddyfile /etc/caddy/Caddyfile

ENV XDG_CONFIG_HOME=/config
ENV XDG_DATA_HOME=/data

USER 10001:10001

EXPOSE 8080

ENTRYPOINT ["/usr/bin/caddy"]
CMD ["run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
