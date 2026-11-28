# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# syntax=docker/dockerfile:1.7

FROM golang:1.27.4-alpine@sha256:0a5f7fe796599ff487605987432e7619ae45beeb2fba4c2ce0b907879932aebf AS builder

WORKDIR /src

ARG SNAPFLOW_RELEASE_VERSION=development

COPY apps/origin apps/origin
COPY libs/common-go libs/common-go
COPY libs/tunnel-go libs/tunnel-go

WORKDIR /src/apps/origin

RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	CGO_ENABLED=0 go build -buildvcs=false -trimpath \
	-ldflags="-s -w -buildid= -X main.version=${SNAPFLOW_RELEASE_VERSION}" \
	-o /out/snapflow-origin ./cmd/origin

FROM scratch

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /out/snapflow-origin /usr/local/bin/snapflow-origin

USER 65532:65532

EXPOSE 8080/tcp

ENTRYPOINT ["/usr/local/bin/snapflow-origin"]
