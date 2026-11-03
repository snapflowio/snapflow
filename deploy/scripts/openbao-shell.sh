#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

set -euo pipefail

# shellcheck source=deploy/scripts/lib/openbao-session.sh
. "deploy/scripts/lib/openbao-session.sh"

openbao_session_open
echo "OpenBao is at ${BAO_ADDR} with a ${openbao_token_duration} token. Exit the shell to close the connection."
"${SHELL:-bash}"
