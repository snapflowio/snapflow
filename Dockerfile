# ======================================================================================
# STAGE 1: Builder
# This stage installs Go, Node.js, and all dependencies, then builds the applications.
# ======================================================================================
FROM golang:1.24.4-bookworm as builder

# Install Node.js (LTS version 20.x) and pnpm
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs
# The package manager is installed here. This can be swapped for npm or yarn.
RUN npm install -g pnpm

# Set the application's working directory
WORKDIR /app

# Copy configuration and manifest files first to leverage Docker's layer caching.
# A lockfile (pnpm-lock.yaml, package-lock.json) should be copied for reproducible builds.
COPY .npmrc package.json pnpm-lock.yaml nx.json tsconfig.base.json ./
COPY go.work go.work.sum ./

# Install all Node.js dependencies.
RUN pnpm install --dangerously-allow-all-builds

# Copy the entire source code for all apps and packages.
COPY . .

# Run the main production build script.
RUN pnpm run build:production

# ======================================================================================
# STAGE 2: Runner
# This stage creates the final, lightweight production image by copying only the
# necessary artifacts from the builder stage.
# ======================================================================================
FROM node:20-slim as runner

# Set the working directory for the running application
WORKDIR /app

# Set the environment to production to optimize performance
ENV NODE_ENV=production

# Copy the built application artifacts from the builder stage.
COPY --from=builder /app/dist ./dist

# Copy the installed node_modules from the builder stage.
# This ensures the exact modules the app was built with are used.
COPY --from=builder /app/node_modules ./node_modules

# The Go binaries in your 'dist' folder need to be marked as executable.
# The paths here are based on your screenshot of the 'dist' directory.
# Please verify these paths match your build output.
RUN chmod +x ./dist/apps/executor
RUN chmod +x ./dist/apps/node
RUN chmod +x ./dist/apps/node-amd64

# Copy the entrypoint script into the image.
COPY entrypoint.sh /usr/local/bin/
# Make the entrypoint script executable.
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8081

# Define the command to start the application.
# This runs the main entry point of your NestJS API using the Node.js runtime.
CMD ["entrypoint.sh"]
