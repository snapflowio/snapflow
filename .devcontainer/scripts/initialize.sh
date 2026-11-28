#!/usr/bin/env bash
set -euo pipefail

config_file="$(pwd -P)/.devcontainer/devcontainer.json"
project="$(docker container ls --all \
	--filter "label=devcontainer.config_file=${config_file}" \
	--format '{{.Label "com.docker.compose.project"}}' | head -n 1)"
if [[ -z "$project" ]]; then
	exit 0
fi

stale=()
while read -r container; do
	for network in $(docker container inspect \
		--format '{{range .NetworkSettings.Networks}}{{.NetworkID}} {{end}}' "$container"); do
		if ! docker network inspect "$network" >/dev/null 2>&1; then
			stale+=("$container")
			break
		fi
	done
done < <(docker container ls --all --quiet --filter "label=com.docker.compose.project=${project}")

if ((${#stale[@]} == 0)); then
	exit 0
fi

printf 'Removing %d %s container(s) attached to a network that no longer exists; volumes are kept.\n' \
	"${#stale[@]}" "$project"
docker container rm --force "${stale[@]}" >/dev/null
