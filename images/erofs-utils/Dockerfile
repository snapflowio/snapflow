# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

FROM alpine:3.22@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8 AS build

COPY --chmod=0755 .devcontainer/scripts/build-erofs-utils.sh /usr/local/bin/build-erofs-utils
RUN build-erofs-utils /out

FROM scratch

COPY --from=build /out/mkfs.erofs /mkfs.erofs
