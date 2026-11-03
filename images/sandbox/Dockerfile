# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

FROM node:25-trixie-slim@sha256:aabbe39553d15ede8a97cc60c9e1a97034ff772afcf696ea42b94e7f5f2ec71b AS node

FROM python:3.14-slim-trixie@sha256:cd89c30eda26ee911a4611b18680086e0ea42e6f5f8cbe653d07fa7958c9cec8

RUN apt-get update && apt-get install -y --no-install-recommends \
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

RUN python3 -m pip install --no-cache-dir --root-user-action=ignore \
    pipx==1.8.0 \
    uv==0.9.26 \
    python-lsp-server==1.14.0 \
    requests==2.32.5

RUN npm install -g \
    typescript@5.9.3 \
    typescript-language-server@5.1.3 \
    ts-node@10.9.2 \
    && npm cache clean --force

RUN useradd -m -s /usr/bin/zsh snapflow \
    && echo "snapflow ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/91-snapflow

ENV NPM_CONFIG_PREFIX=/home/snapflow/.npm-global \
    PATH=/home/snapflow/.npm-global/bin:/home/snapflow/.local/bin:$PATH

USER snapflow

RUN touch ~/.zshrc

ENTRYPOINT [ "sleep", "infinity" ]
