# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# syntax=docker/dockerfile:1.7

FROM golang:1.27.3-alpine@sha256:d200d2dd76b03a99b52651fd1325aff7dcd35422c35c01bac56571b0507f3deb AS builder

WORKDIR /src

ARG SNAPFLOW_RELEASE_VERSION=development

COPY apps/edge apps/edge
COPY libs/api-client-go libs/api-client-go
COPY libs/common-go libs/common-go
COPY libs/machine-proto libs/machine-proto
COPY libs/tunnel-go libs/tunnel-go

WORKDIR /src/apps/edge

RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	CGO_ENABLED=0 go build -buildvcs=false -trimpath \
	-ldflags="-s -w -buildid= -X main.version=${SNAPFLOW_RELEASE_VERSION}" \
	-o /out/snapflow-edge ./cmd/edge

FROM scratch

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /out/snapflow-edge /usr/local/bin/snapflow-edge

USER 65532:65532

EXPOSE 80/tcp 443/tcp 8443/tcp 8443/udp

HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --start-interval=2s --retries=3 \
	CMD ["/usr/local/bin/snapflow-edge", "--check-health"]

ENTRYPOINT ["/usr/local/bin/snapflow-edge"]
