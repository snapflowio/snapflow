# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

FROM node:26-trixie-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS node

FROM python:3.15-slim-trixie@sha256:65a65fc7b30b06cb6df4930fd4650697cb23f4c2698ab81fc87e4b031bc36928

RUN apt-get update && apt-get upgrade -y --no-install-recommends && apt-get install -y --no-install-recommends \
    bind9-dnsutils \
    ca-certificates \
    curl \
    git \
    iputils-ping \
    less \
    libatomic1 \
    openssh-client \
    procps \
    ripgrep \
    sudo \
    zsh \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

RUN python3 -m pip install --no-cache-dir --root-user-action=ignore --upgrade pip==26.3 \
    && python3 -m pip install --no-cache-dir --root-user-action=ignore \
    pipx==1.18.16 \
    uv==0.13.8 \
    python-lsp-server==1.15.0 \
    requests==2.34.2

RUN npm install -g npm@12.2.2 \
    && npm install -g \
    typescript@6.0.3 \
    typescript-language-server@6.1.0 \
    ts-node@10.9.2 \
    && npm cache clean --force

RUN useradd -m -s /usr/bin/zsh snapflow \
    && echo "snapflow ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/91-snapflow

ENV NPM_CONFIG_PREFIX=/home/snapflow/.npm-global \
    PATH=/home/snapflow/.npm-global/bin:/home/snapflow/.local/bin:$PATH

USER snapflow

RUN touch ~/.zshrc

ENTRYPOINT [ "sleep", "infinity" ]
