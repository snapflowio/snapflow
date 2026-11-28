# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

FROM golang:1.27.4-bookworm@sha256:4fa7c968ba93f1635670522dbb01a2c78150443e1385746924566079f36570ea AS build

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

FROM debian:trixie-20261104-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2 AS kasmvnc

ARG TARGETARCH
ARG KASMVNC_VERSION=1.5.2

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && case "${TARGETARCH}" in \
        amd64) kasmvnc_sha256="6ed957163275088a5ce52b525f82f145014e3289699d576ce26745a4249407f8" ;; \
        arm64) kasmvnc_sha256="904615b506c517242f3da3ff2eacd349013fc8cdb2dc205e5e4dad4ec6f62fa9" ;; \
        *) echo "unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && curl -fsSL \
        "https://github.com/kasmtech/KasmVNC/releases/download/v${KASMVNC_VERSION}/kasmvncserver_debian_trixie_${KASMVNC_VERSION}_${TARGETARCH}.deb" \
        -o /tmp/kasmvnc.deb \
    && echo "${kasmvnc_sha256}  /tmp/kasmvnc.deb" | sha256sum -c -

FROM debian:trixie-20261104-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    GTK_MODULES=gail:atk-bridge \
    QT_ACCESSIBILITY=1 \
    NO_AT_BRIDGE=0

COPY --from=kasmvnc /tmp/kasmvnc.deb /tmp/kasmvnc.deb

RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
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
