# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY nx.json tsconfig.base.json ./

# Copy all source code for monorepo build
COPY apps/ apps/
COPY packages/ packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build just the website
RUN pnpm nx run website:build:production

# Production stage
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set working directory
WORKDIR /app

# Copy the entire standalone application structure
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/.next/standalone ./

# Copy static files to the correct location within standalone structure  
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/.next/static ./apps/website/.next/static

# Copy public assets to standalone structure
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/public ./apps/website/public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application with proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/website/server.js"]