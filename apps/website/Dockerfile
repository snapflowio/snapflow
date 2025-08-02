FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy monorepo package files and app package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
COPY nx.json tsconfig.base.json ./
COPY apps/website/package.json ./apps/website/
COPY packages/ ./packages/

# Install all dependencies including workspace dependencies
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the website using Nx
RUN corepack enable pnpm && pnpm nx run website:build:production

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone directory structure
COPY --from=builder --chown=nextjs:nodejs /app/dist/apps/website/standalone ./

# Copy only the essential build files (no duplication)
COPY --from=builder --chown=nextjs:nodejs /app/dist/apps/website/static ./dist/apps/website/static
COPY --from=builder --chown=nextjs:nodejs /app/dist/apps/website/public ./apps/website/public
COPY --from=builder --chown=nextjs:nodejs /app/dist/apps/website/*.json ./dist/apps/website/
COPY --from=builder --chown=nextjs:nodejs /app/dist/apps/website/BUILD_ID ./dist/apps/website/BUILD_ID

USER nextjs

# Change to the directory where server.js is located
WORKDIR /app/apps/website

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

CMD ["node", "server.js"]