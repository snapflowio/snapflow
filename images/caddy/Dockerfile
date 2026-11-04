# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Builds what the dashboard and marketing images add to their shell-less
# Chainguard static base, through the bake "caddy" context (docker-bake.hcl):
#   /caddy       the static Caddy binary
#   /mime.types  the MIME table Caddy serves files with
#   /writable/   Caddy's config and data directories, for the runtime user
FROM golang:1.27.3-bookworm@sha256:d9b6a1beb9474adc2a1ce842573639b44b2a0dd49b6669f51d3821baf9ec37c9 AS build

WORKDIR /src
COPY images/caddy/go.mod images/caddy/go.sum ./
RUN go mod download && go mod verify
COPY images/caddy/main.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/caddy . \
	&& /out/caddy version \
	&& install -d -m 0755 /out/writable/config /out/writable/data

FROM scratch
COPY --from=build /out/caddy /caddy
COPY --from=build /etc/mime.types /mime.types
COPY --from=build /out/writable/ /writable/
