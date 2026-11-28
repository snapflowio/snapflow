#!/usr/bin/env bash
set -euo pipefail

workspace_dir="${PWD%/}"
if [[ ! -w "$workspace_dir" ]]; then
	printf 'error: %s is not writable by uid %s; rebuild the devcontainer so UID/GID mapping can be applied\n' \
		"$workspace_dir" "$(id -u)" >&2
	exit 1
fi

install -d -m 0750 \
	"$GOBIN" \
	"$GOMODCACHE" \
	"$GOTMPDIR" \
	"$NPM_CONFIG_CACHE" \
	"$PNPM_STORE_PATH" \
	"$TMPDIR" \
	"$XDG_CACHE_HOME/go-build" \
	"$XDG_CACHE_HOME/snapflow"

go env -w GOBIN="$GOBIN" GOTMPDIR="$GOTMPDIR"
pnpm config set store-dir "$PNPM_STORE_PATH" --global

if command -v update-binfmts >/dev/null 2>&1; then
	sudo update-binfmts --enable
fi

printf 'devcontainer provisioning complete for %s (uid=%s gid=%s)\n' \
	"$(id -un)" "$(id -u)" "$(id -g)"
