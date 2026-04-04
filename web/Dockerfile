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
COPY web/package.json web/package.json
COPY clients/api-client-ts/package.json clients/api-client-ts/package.json
COPY clients/toolbox-client-ts/package.json clients/toolbox-client-ts/package.json
COPY sdk/typescript-sdk/package.json sdk/typescript-sdk/package.json
RUN --mount=type=cache,sharing=locked,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY web/ web/
COPY clients/ clients/
COPY sdk/ sdk/
COPY tsconfig.base.json biome.json ./
RUN cd web && bun run build

FROM busybox:1.36 AS runtime
WORKDIR /app
COPY --from=builder /build/dist/web ./
RUN cp index.html 404.html
EXPOSE 8080
CMD ["busybox", "httpd", "-f", "-v", "-p", "8080"]
