# Start from Ubuntu 22.04
FROM ubuntu:22.04

# 1. Install dependencies, create a non-root user, and grant sudo access
RUN apt-get update && apt-get install -y --no-install-recommends \
    sudo \
    curl \
    ca-certificates \
  && useradd -m snapflow \
  && echo "snapflow ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/91-snapflow \
  && chmod 0440 /etc/sudoers.d/91-snapflow \
  # Clean up apt cache to reduce image size
  && rm -rf /var/lib/apt/lists/*

# Set environment variables for locale
ENV LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8

# Switch to the non-root user
USER snapflow
WORKDIR /home/snapflow

# 2. Set environment variables for nvm and Node.js
# Using a specific LTS version for build reproducibility (e.g., Node.js 20)
ENV NVM_DIR=/home/snapflow/.nvm
ENV NODE_VERSION=20.15.0
ENV PATH=$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# 3. Download and run nvm installer, install Node.js and global npm packages
# Using bash -c ensures nvm is sourced correctly for the subsequent commands
RUN bash -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && npm install -g ts-node typescript typescript-language-server"

# Touch a file as the user (from original Dockerfile)
RUN touch ~/.zshrc

# Keep the container running
ENTRYPOINT [ "sleep", "infinity" ]