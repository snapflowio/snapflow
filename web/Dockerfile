# syntax=docker/dockerfile:1.4

FROM oven/bun:1.3.10-alpine AS builder
WORKDIR /build

ARG VITE_API_URL
ARG VITE_WEBSITE_URL
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
ARG VITE_SHOW_ENTERPRISE
ARG VITE_PROXY_TEMPLATE_URL

COPY package.json bun.lock ./
COPY web/ web/
COPY clients/ clients/
COPY sdk/ sdk/
COPY tsconfig.base.json biome.json ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
RUN cd web && bun run build

FROM caddy:alpine AS runtime
COPY --from=builder /build/dist/web /srv
RUN echo ':80 { root * /srv; try_files {path} /index.html; file_server }' > /etc/caddy/Caddyfile
EXPOSE 80
