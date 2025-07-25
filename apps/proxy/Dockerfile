# --- Build Stage ---
FROM golang:1.24.4-alpine AS builder

# Set the working directory for the entire monorepo
WORKDIR /workspace

# 1. Copy all Go module dependency files first to leverage Docker's cache.
# This step ensures that dependencies are only re-downloaded when a go.mod,
# go.sum, or go.work file changes.
COPY go.work go.work.sum ./

# Copy Go app module files
COPY apps/executor/go.mod apps/executor/go.sum ./apps/executor/
COPY apps/node/go.mod apps/node/go.sum ./apps/node/
COPY apps/proxy/go.mod apps/proxy/go.sum ./apps/proxy/

# Copy Go package module files
COPY packages/api-client-go/go.mod packages/api-client-go/go.sum ./packages/api-client-go/
COPY packages/go-common/go.mod packages/go-common/go.sum ./packages/go-common/

# 2. Sync dependencies now that all go.mod files are present in the container.
RUN go work sync

# 3. Copy the entire monorepo source code. This layer will only be rebuilt
# when your actual source code changes.
COPY . .

# 4. Build the specific 'proxy' application.
RUN CGO_ENABLED=0 GOOS=linux go build -a -o proxy-server ./apps/proxy/cmd/proxy


# --- Final Stage ---
FROM alpine:latest

# Install ca-certificates for making HTTPS requests from the application
RUN apk --no-cache add ca-certificates

# Create a non-root user and group for security best practices
RUN addgroup -g 1000 -S proxy && \
    adduser -u 1000 -S proxy -G proxy

# Set the application's working directory
WORKDIR /app

# Copy the compiled binary from the builder stage.
# This is the only file we need from the builder, resulting in a small final image.
COPY --from=builder /workspace/proxy-server .

# Change ownership of the app directory and binary to the non-root user
RUN chown -R proxy:proxy /app

# Switch to the non-root user
USER proxy

# Expose the port the proxy server will run on
EXPOSE 4000

# The command to run when the container starts
CMD ["./proxy-server"]