# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

FROM golang:1.27.3-bookworm@sha256:d9b6a1beb9474adc2a1ce842573639b44b2a0dd49b6669f51d3821baf9ec37c9 AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libx11-dev libxtst-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY libs/common-go ./libs/common-go
COPY libs/computer-use ./libs/computer-use

RUN go work init \
    ./libs/common-go \
    ./libs/computer-use

ARG TARGETARCH
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 GOOS=linux GOARCH="${TARGETARCH}" go build \
    -trimpath -ldflags="-s -w" \
    -o /out/snapflow-computer-use ./libs/computer-use \
    && CGO_ENABLED=0 GOOS=linux GOARCH="${TARGETARCH}" go build \
    -trimpath -ldflags="-s -w" \
    -o /out/snapflow-desktop ./libs/computer-use/cmd/desktop-launcher

FROM debian:bookworm-20260824-slim@sha256:88200866dfff7ea7f5cbcb6ec7c8a701889efe6fe859fe64d6990e4b07ea4171 AS kasmvnc

ARG TARGETARCH
ARG KASMVNC_VERSION=1.5.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && case "${TARGETARCH}" in \
        amd64) kasmvnc_sha256="770fd3df51510beecc89666879d82faf411276e68c6e11df612f736b891b5f71" ;; \
        arm64) kasmvnc_sha256="aa83a1a6c9069d1a02239988b07a3a2a082a433042b4d4ee2b9e9f6b2df9643c" ;; \
        *) echo "unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && curl -fsSL \
        "https://github.com/kasmtech/KasmVNC/releases/download/v${KASMVNC_VERSION}/kasmvncserver_bookworm_${KASMVNC_VERSION}_${TARGETARCH}.deb" \
        -o /tmp/kasmvnc.deb \
    && echo "${kasmvnc_sha256}  /tmp/kasmvnc.deb" | sha256sum -c -

FROM debian:bookworm-20260824-slim@sha256:88200866dfff7ea7f5cbcb6ec7c8a701889efe6fe859fe64d6990e4b07ea4171

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    GTK_MODULES=gail:atk-bridge \
    QT_ACCESSIBILITY=1 \
    NO_AT_BRIDGE=0

COPY --from=kasmvnc /tmp/kasmvnc.deb /tmp/kasmvnc.deb

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        at-spi2-core \
        ca-certificates \
        chromium \
        chromium-sandbox \
        dbus-x11 \
        fonts-dejavu-core \
        fonts-liberation \
        x11-utils \
        xdotool \
        xfce4 \
        xfce4-terminal \
        /tmp/kasmvnc.deb \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /tmp/kasmvnc.deb \
    && mkdir -p \
        /components \
        /dev \
        /home/snapflow \
        /mnt/sandbox \
        /proc \
        /run/snapflow \
        /sys \
        /tmp \
        /workspace \
    && ln -s /components/snapflow-desktop /usr/local/bin/xfce4-terminal \
    && chmod 1777 /tmp

COPY --from=build --chmod=0755 /out/snapflow-desktop /components/snapflow-desktop
COPY --from=build --chmod=0755 /out/snapflow-computer-use /components/snapflow-computer-use
