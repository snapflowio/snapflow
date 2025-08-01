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

# Install dumb-init and create non-root user
RUN apk add --no-cache dumb-init && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set working directory
WORKDIR /app

# Enable pnpm and copy package.json from website dist and install production dependencies
RUN corepack enable pnpm
COPY --from=builder --chown=nextjs:nodejs /app/dist/apps/website/package.json ./package.json
RUN pnpm install --prod

# Copy the entire standalone application structure
COPY --from=builder --chown=nextjs:nodejs /app/dist/apps/website/standalone ./

# Copy static files to the correct location within standalone structure  
COPY --from=builder --chown=nextjs:nodejs /app/dist/apps/website/static ./.next/static

# Copy public assets to standalone structure
COPY --from=builder --chown=nextjs:nodejs /app/dist/apps/website/public ./public

# Copy next.config from dist folder
COPY --from=builder --chown=nextjs:nodejs /app/dist/apps/website/next.config.ts ./next.config.ts

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the application with proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/website/server.js"]