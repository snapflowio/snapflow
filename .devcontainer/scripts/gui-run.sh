#!/usr/bin/env bash
set -euo pipefail

readonly wslg_runtime_directory="/mnt/wslg/runtime-dir"
readonly wslg_x11_directory="/mnt/wslg/.X11-unix"
readonly headless_screen="1920x1080x24"
readonly software_rendering_environment="SNAPFLOW_GUI_SOFTWARE_RENDERING"

if (( $# == 0 )); then
	printf 'error: gui-run requires a command to execute\n' >&2
	exit 2
fi

find_wayland_runtime_directory() {
	local display_name="${WAYLAND_DISPLAY:-wayland-0}"
	local candidate
	for candidate in "${XDG_RUNTIME_DIR:-}" "/run/user/$(id -u)"
	do
		if [[ -n "$candidate" && -S "$candidate/$display_name" ]]; then
			export WAYLAND_DISPLAY="$display_name"
			export XDG_RUNTIME_DIR="$candidate"
			export XDG_SESSION_TYPE="wayland"
			return 0
		fi
	done

	if [[ -S "$wslg_runtime_directory/$display_name" ]]; then
		local private_runtime_directory
		private_runtime_directory="${TMPDIR:-/tmp}/snapflow-gui-runtime-$(id -u)"
		install -d -m 0700 "$private_runtime_directory"
		rm -f \
			"$private_runtime_directory/$display_name" \
			"$private_runtime_directory/${display_name}.lock"
		ln -s "$wslg_runtime_directory/$display_name" \
			"$private_runtime_directory/$display_name"
		if [[ -e "$wslg_runtime_directory/${display_name}.lock" ]]; then
			ln -s "$wslg_runtime_directory/${display_name}.lock" \
				"$private_runtime_directory/${display_name}.lock"
		fi
		export WAYLAND_DISPLAY="$display_name"
		export XDG_RUNTIME_DIR="$private_runtime_directory"
		export XDG_SESSION_TYPE="wayland"
		return 0
	fi
	return 1
}

find_x11_display() {
	local display="${DISPLAY:-:0}"
	local display_number="${display#*:}"
	display_number="${display_number%%.*}"
	[[ "$display_number" =~ ^[0-9]+$ ]] || return 1

	if [[ -S "/tmp/.X11-unix/X${display_number}" ]]; then
		export DISPLAY="$display"
		export XDG_SESSION_TYPE="x11"
		return 0
	fi
	if [[ -S "$wslg_x11_directory/X${display_number}" ]]; then
		install -d -m 1777 /tmp/.X11-unix
		rm -f "/tmp/.X11-unix/X${display_number}"
		ln -s "$wslg_x11_directory/X${display_number}" \
			"/tmp/.X11-unix/X${display_number}"
		export DISPLAY="$display"
		export XDG_SESSION_TYPE="x11"
		if [[ -f /mnt/wslg/.Xauthority ]]; then
			export XAUTHORITY="${XAUTHORITY:-/mnt/wslg/.Xauthority}"
		fi
		return 0
	fi
	return 1
}

run_gui_command() {
	if ! compgen -G '/dev/dri/renderD*' >/dev/null; then
		export "$software_rendering_environment=true"
	fi
	if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]]; then
		if [[ ! -d "${XDG_RUNTIME_DIR:-}" || ! -w "${XDG_RUNTIME_DIR:-}" ]]; then
			local runtime_directory
			runtime_directory="${TMPDIR:-/tmp}/snapflow-gui-runtime-$(id -u)"
			install -d -m 0700 "$runtime_directory"
			export XDG_RUNTIME_DIR="$runtime_directory"
		fi
		if ! command -v dbus-run-session >/dev/null 2>&1; then
			printf 'error: gui-run requires dbus-run-session\n' >&2
			exit 1
		fi
		exec dbus-run-session -- bash "$0" "$@"
	fi
	export DBUS_SYSTEM_BUS_ADDRESS="${DBUS_SYSTEM_BUS_ADDRESS:-$DBUS_SESSION_BUS_ADDRESS}"
	exec "$@"
}

start_wayland_command() {
	find_wayland_runtime_directory || return 1
	export PULSE_SERVER="${PULSE_SERVER:-unix:/mnt/wslg/PulseServer}"
	if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]]; then
		run_gui_command "$@"
	fi
	printf 'Using Wayland display %s from %s\n' "$WAYLAND_DISPLAY" "$XDG_RUNTIME_DIR"
	run_gui_command "$@"
}

start_x11_command() {
	find_x11_display || return 1
	export PULSE_SERVER="${PULSE_SERVER:-unix:/mnt/wslg/PulseServer}"
	if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]]; then
		run_gui_command "$@"
	fi
	printf 'Using X11 display %s\n' "$DISPLAY"
	run_gui_command "$@"
}

start_headless_command() {
	if ! command -v xvfb-run >/dev/null 2>&1; then
		printf 'error: SNAPFLOW_GUI_HEADLESS=true requires xvfb-run\n' >&2
		exit 1
	fi
	if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]]; then
		run_gui_command "$@"
	fi
	printf 'Using explicit headless Xvfb mode\n'
	run_gui_command xvfb-run -a -s "-screen 0 $headless_screen" "$@"
}

if [[ "${SNAPFLOW_GUI_HEADLESS:-false}" == "true" ]]; then
	start_headless_command "$@"
	exit 0
fi

if compgen -G '/dev/dri/renderD*' >/dev/null && start_wayland_command "$@"; then
	exit 0
fi

if start_x11_command "$@"; then
	exit 0
fi
if start_wayland_command "$@"; then
	exit 0
fi

cat >&2 <<'EOF'
error: no usable GUI display is available

For WSLg, recreate the Snapflow devcontainer so /mnt/wslg is mounted and the
Wayland environment is refreshed. For CI or a noninteractive smoke run, set
SNAPFLOW_GUI_HEADLESS=true explicitly.
EOF
exit 1
