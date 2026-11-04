#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

if [[ -t 1 ]]; then
  RED=$'\033[0;31m'
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[1;33m'
  NC=$'\033[0m'
else
  RED=""
  GREEN=""
  YELLOW=""
  NC=""
fi

ASSUME_YES=0
DRY_RUN=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Removes local dependencies, build outputs, caches, and OS/editor junk from this
Snapflow workspace.

Options:
  -n, --dry-run   Show what would be deleted without deleting anything
  -y, --yes       Delete without prompting
  -h, --help      Show this help
EOF
}

while (($#)); do
  case "$1" in
    -n | --dry-run)
      DRY_RUN=1
      ;;
    -y | --yes)
      ASSUME_YES=1
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "${RED}Unknown option: $1${NC}" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

cd "$ROOT_DIR"

declare -a ENTRIES=()
declare -A SEEN=()

add_entry() {
  local entry="$1"

  [[ -n "$entry" ]] || return 0
  [[ -e "$entry" || -L "$entry" ]] || return 0
  [[ -z "${SEEN[$entry]:-}" ]] || return 0

  SEEN["$entry"]=1
  ENTRIES+=("$entry")
}

collapse_nested_entries() {
  local -a collapsed=()
  local entry kept

  while IFS= read -r entry; do
    for kept in "${collapsed[@]}"; do
      if [[ "$entry" == "$kept/"* ]]; then
        continue 2
      fi
    done

    collapsed+=("$entry")
  done

  printf '%s\n' "${collapsed[@]}"
}

echo "${YELLOW}Searching for local dependencies, build outputs, caches, and OS/editor junk...${NC}"

add_entry "./bin"
add_entry "./tmp"
add_entry "./core"
add_entry "./.pnpm-store"
add_entry "./.moon/cache"

PRUNE_PATHS=(
  -path './.git' -o
  -path './reference' -o
  -path './references'
)

TARGET_DIRS=(
  -name 'node_modules' -o
  -name '.vite' -o
  -name 'dist' -o
  -name 'out-tsc' -o
  -name 'coverage' -o
  -name 'target' -o
  -name '.tmp' -o
  -name '__pycache__' -o
  -name '.pytest_cache' -o
  -name '.ruff_cache' -o
  -name '.mypy_cache'
)

TARGET_FILES=(
  -name '*.tsbuildinfo' -o
  -name 'vite.config.*.timestamp*' -o
  -name 'vitest.config.*.timestamp*' -o
  -name '*.lcov' -o
  -name '*.test' -o
  -name 'coverage.out' -o
  -name '.DS_Store' -o
  -name 'Thumbs.db' -o
  -name '._*'
)

while IFS= read -r -d '' entry; do
  add_entry "$entry"
done < <(
  find . \
    \( "${PRUNE_PATHS[@]}" \) -prune -o \
    \( -type d \( "${TARGET_DIRS[@]}" \) \) -print0 -prune -o \
    \( -type f \( "${TARGET_FILES[@]}" \) \) -print0 2>/dev/null
)

if ((${#ENTRIES[@]} == 0)); then
  echo "${GREEN}Nothing to clean.${NC}"
  exit 0
fi

mapfile -t ENTRIES < <(printf '%s\n' "${ENTRIES[@]}" | sort | collapse_nested_entries)
COUNT=${#ENTRIES[@]}

echo "${YELLOW}Found ${COUNT} entr$(if ((COUNT == 1)); then echo "y"; else echo "ies"; fi) to clean:${NC}"
printf '%s\n' "${ENTRIES[@]}"
echo ""

if ((DRY_RUN)); then
  echo "${GREEN}Dry run complete. Nothing was deleted.${NC}"
  exit 0
fi

if ((ASSUME_YES == 0)); then
  read -r -p "Do you want to permanently delete all these entries? (y/N): " REPLY
  echo ""

  if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    echo "${RED}Aborted.${NC}"
    exit 1
  fi
fi

echo "${YELLOW}Deleting entries...${NC}"

DELETED=0
FAILED=0

for entry in "${ENTRIES[@]}"; do
  if [[ -e "$entry" || -L "$entry" ]]; then
    echo "Deleting: $entry"
    if rm -rf -- "$entry"; then
      DELETED=$((DELETED + 1))
    else
      FAILED=$((FAILED + 1))
      echo "${RED}Failed to delete: $entry${NC}" >&2
    fi
  fi
done

if ((FAILED > 0)); then
  echo "${RED}Deleted ${DELETED} entr$(if ((DELETED == 1)); then echo "y"; else echo "ies"; fi); ${FAILED} failed.${NC}"
  exit 1
fi

echo "${GREEN}Successfully deleted ${DELETED} entr$(if ((DELETED == 1)); then echo "y"; else echo "ies"; fi).${NC}"
