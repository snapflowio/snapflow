# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

FROM golang:1.27.3-bookworm@sha256:d9b6a1beb9474adc2a1ce842573639b44b2a0dd49b6669f51d3821baf9ec37c9 AS build

WORKDIR /src
COPY apps/guest ./apps/guest
COPY libs/common-go ./libs/common-go
COPY libs/computer-use ./libs/computer-use

RUN go work init \
    ./apps/guest \
    ./libs/common-go \
    ./libs/computer-use

ARG VERSION=0.0.0-dev
ARG TARGETARCH
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH="${TARGETARCH}" go build \
    -trimpath \
    -ldflags="-s -w -X github.com/snapflowio/guest/internal/buildinfo.Version=${VERSION}" \
    -o /out/snapflow-guest ./apps/guest/cmd/snapflow-guest

FROM scratch

COPY --from=build --chmod=0755 /out/snapflow-guest /components/snapflow-guest
