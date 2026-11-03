#!/usr/bin/env bash
# Runs on the host before the dev container stack starts (initializeCommand).
#
# A container stores the ID of each network it joins. When the Docker daemon
# stops uncleanly (wsl --shutdown, a crash), compose can recreate the project
# network under a new ID, and the old containers then fail to start with
# "network <id> not found". The dev container CLI starts existing containers
# with --no-recreate, so it never repairs them. This removes only the
# containers whose network is gone; volumes are kept, and compose recreates
# the containers on the current network.
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
