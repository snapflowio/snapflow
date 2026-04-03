#!/bin/bash

# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Copyright 2025 Snapflow
# SPDX-License-Identifier: AGPL-3.0


# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Searching for node_modules and target directories...${NC}"

MODULES=$(find . -name "node_modules" -type d -prune 2>/dev/null)
TARGETS=$(find . -name "target" -type d -prune -path "*/target" 2>/dev/null | grep -E '(^\.\/target$|\/crates\/.*\/target$|\/clients\/.*\/target$)')

DIRS=""
if [ -n "$MODULES" ]; then
    DIRS="$MODULES"
fi
if [ -n "$TARGETS" ]; then
    if [ -n "$DIRS" ]; then
        DIRS="$DIRS"$'\n'"$TARGETS"
    else
        DIRS="$TARGETS"
    fi
fi

if [ -z "$DIRS" ]; then
    echo -e "${GREEN}No node_modules or target directories found.${NC}"
    exit 0
fi

COUNT=$(echo "$DIRS" | wc -l)

echo -e "${YELLOW}Found ${COUNT} director(ies) to clean:${NC}"
echo "$DIRS"
echo ""

read -p "Do you want to permanently delete all these directories? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

echo -e "${YELLOW}Deleting directories...${NC}"

DELETED=0
while IFS= read -r dir; do
    if [ -d "$dir" ]; then
        echo "Deleting: $dir"
        rm -rf "$dir"
        if [ $? -eq 0 ]; then
            DELETED=$((DELETED + 1))
        else
            echo -e "${RED}Failed to delete: $dir${NC}"
        fi
    fi
done <<< "$DIRS"

echo -e "${GREEN}Successfully deleted ${DELETED} out of ${COUNT} directories.${NC}"