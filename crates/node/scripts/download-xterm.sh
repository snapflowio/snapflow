#!/bin/bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Copyright 2025 Snapflow
# SPDX-License-Identifier: AGPL-3.0

set -euo pipefail

XTERM_VERSION="6.0.0"
XTERM_FIT_VERSION="0.11.0"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATIC_DIR="$(dirname "$SCRIPT_DIR")/src/terminal/static"

mkdir -p "$STATIC_DIR"

echo "Downloading xterm.js files..."

curl -sL "https://cdn.jsdelivr.net/npm/@xterm/xterm@${XTERM_VERSION}/lib/xterm.js" -o "$STATIC_DIR/xterm.js"
echo "  Downloaded xterm.js"

curl -sL "https://cdn.jsdelivr.net/npm/@xterm/xterm@${XTERM_VERSION}/css/xterm.css" -o "$STATIC_DIR/xterm.css"
echo "  Downloaded xterm.css"

curl -sL "https://cdn.jsdelivr.net/npm/@xterm/addon-fit@${XTERM_FIT_VERSION}/lib/addon-fit.js" -o "$STATIC_DIR/xterm-addon-fit.js"
echo "  Downloaded xterm-addon-fit.js"

echo "xterm.js files downloaded successfully"
