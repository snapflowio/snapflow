FROM oven/bun:1.2.20-slim as builder

# Set the application's working directory
WORKDIR /app

# Copy configuration and manifest files first to leverage Docker's layer caching.
COPY package.json bun.lock nx.json tsconfig.base.json ./
COPY components.json biome.json openapitools.json project.json tsconfig.json ./

# Install all dependencies using Bun
RUN bun install --frozen-lockfile

# Copy the entire source code for all apps and packages.
COPY . .

# Run the main production build script.
RUN bun run build:production

# ======================================================================================
# STAGE 2: Runner
# This stage creates the final, lightweight production image by copying only the
# necessary artifacts from the builder stage.
# ======================================================================================
FROM oven/bun:1.1-slim as runner

# Set the working directory for the running application
WORKDIR /app

# Set the environment to production to optimize performance
ENV NODE_ENV=production

# Copy the built application artifacts from the builder stage.
COPY --from=builder /app/dist ./dist

# Copy the installed node_modules from the builder stage.
# This ensures the exact modules the app was built with are used.
COPY --from=builder /app/node_modules ./node_modules

# Copy package.json for any runtime dependencies
COPY --from=builder /app/package.json ./

COPY ./entrypoint.sh /
RUN chmod +x /entrypoint.sh

EXPOSE 8081

CMD ["/entrypoint.sh"]