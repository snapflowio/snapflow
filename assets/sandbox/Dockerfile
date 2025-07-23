FROM ubuntu:22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    sudo \
    curl \
    ca-certificates \
    git \
    bash \
    && useradd -m -s /bin/bash snapflow \
    && echo "snapflow ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/91-snapflow \
    && chmod 0440 /etc/sudoers.d/91-snapflow \
    && rm -rf /var/lib/apt/lists/*

# Switch to the non-root user
USER snapflow
WORKDIR /home/snapflow

# Install Node.js using NodeSource repository
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - \
    && sudo apt-get install -y nodejs \
    && sudo npm install -g ts-node typescript typescript-language-server \
    && sudo rm -rf /var/lib/apt/lists/*

# Create shell configuration
RUN touch ~/.bashrc

# Keep the container running
ENTRYPOINT ["sleep", "infinity"]