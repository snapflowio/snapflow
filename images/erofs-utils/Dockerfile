# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

FROM alpine:3.24@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf AS build

COPY --chmod=0755 .devcontainer/scripts/build-erofs-utils.sh /usr/local/bin/build-erofs-utils
RUN build-erofs-utils /out

FROM scratch

COPY --from=build /out/mkfs.erofs /mkfs.erofs
