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

FROM caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d AS runtime

RUN addgroup -S -g 10001 snapflow \
	&& adduser -S -D -H -u 10001 -G snapflow snapflow \
	&& setcap -r /usr/bin/caddy \
	&& install -d -m 0755 -o snapflow -g snapflow /srv/snapflow /config /data

COPY --from=builder --chown=snapflow:snapflow /build/dist/apps/marketing/ /srv/snapflow/
COPY --chown=snapflow:snapflow apps/marketing/Caddyfile /etc/caddy/Caddyfile

ENV XDG_CONFIG_HOME=/config
ENV XDG_DATA_HOME=/data

USER 10001:10001

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
	CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
