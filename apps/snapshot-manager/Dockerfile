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

COPY apps/snapshot-manager apps/snapshot-manager
COPY libs/common-go libs/common-go

WORKDIR /src/apps/snapshot-manager

RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	CGO_ENABLED=0 GOWORK=off go build -buildvcs=false -trimpath \
	-ldflags="-s -w -buildid= -X main.version=${SNAPFLOW_RELEASE_VERSION}" \
	-o /out/snapflow-snapshot-manager ./cmd/snapshot-manager

FROM alpine:3.24@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf

RUN apk upgrade --no-cache \
	&& apk add --no-cache ca-certificates \
	&& addgroup -S -g 10001 snapflow \
	&& adduser -S -D -H -u 10001 -G snapflow snapflow \
	&& install -d -m 0700 -o snapflow -g snapflow /var/lib/snapflow-snapshot-manager

COPY --from=builder /out/snapflow-snapshot-manager /usr/local/bin/snapflow-snapshot-manager

USER 10001:10001

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
	CMD wget --quiet --tries=1 --spider http://127.0.0.1:5000/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/snapflow-snapshot-manager"]
