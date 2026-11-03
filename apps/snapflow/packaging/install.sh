#!/bin/sh
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0


set -eu

init_settings() {
	DEFAULT_BASE_URL="https://github.com/snapflowio/snapflow/releases"
	BASE_URL="${SNAPFLOW_INSTALL_BASE_URL:-$DEFAULT_BASE_URL}"
	BIN_DIRECTORY="/usr/local/bin"
	INSTALL_PATH="$BIN_DIRECTORY/snapflow"
	STAGING_PATH="$BIN_DIRECTORY/.snapflow.install"
	KVM_DEVICE="${SNAPFLOW_INSTALL_KVM_DEVICE:-/dev/kvm}"
	SYSTEMD_DIRECTORY="${SNAPFLOW_INSTALL_SYSTEMD_DIRECTORY:-/run/systemd/system}"
	TERMINAL_DEVICE="/dev/tty"
	SIGNER_IDENTITY='^https://github\.com/snapflowio/snapflow/\.github/workflows/release\.yml@refs/heads/main$'
	SIGNER_ISSUER="https://token.actions.githubusercontent.com"
	EXIT_USAGE=2
	EXIT_UNSUPPORTED=3
	EXIT_VERIFY=65
	EXIT_DOWNLOAD=69
	EXIT_PERMISSION=77

	version="${SNAPFLOW_VERSION:-}"
	channel="${SNAPFLOW_CHANNEL:-stable}"
	dry_run=0
	run_setup=1
	sudo_command=""
	work_directory=""
	if [ "$BASE_URL" = "$DEFAULT_BASE_URL" ]; then
		curl_protocols="=https"
	else
		curl_protocols="=http,https"
	fi
}

init_style() {
	if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
		style_brand=$(printf '\033[1;38;2;139;92;246m')
		style_ok=$(printf '\033[38;2;139;231;170m')
		style_error=$(printf '\033[1;38;2;255;99;92m')
		style_muted=$(printf '\033[38;2;171;169;164m')
		style_reset=$(printf '\033[0m')
	else
		style_brand=""
		style_ok=""
		style_error=""
		style_muted=""
		style_reset=""
	fi
}

say() {
	printf '%s\n' "$*"
}

step() {
	printf '%s✓%s %s\n' "$style_ok" "$style_reset" "$*"
}

note() {
	printf '%s· %s%s\n' "$style_muted" "$*" "$style_reset"
}

fail() {
	exit_code=$1
	shift
	printf '%s✗ %s%s\n' "$style_error" "$1" "$style_reset" >&2
	shift
	for hint in "$@"; do
		printf '  %s→ %s%s\n' "$style_muted" "$hint" "$style_reset" >&2
	done
	exit "$exit_code"
}

usage() {
	cat <<'USAGE'
Install Snapflow.

Usage: install.sh [--version X.Y.Z] [--channel stable|beta] [--dry-run] [--no-setup]

  --version X.Y.Z   install this release instead of the latest stable one (SNAPFLOW_VERSION)
  --channel NAME    update channel for `snapflow setup`: stable or beta (SNAPFLOW_CHANNEL)
  --dry-run         download and verify, then print every change instead of making it
  --no-setup        install only; do not start machine setup
  --help            show this help

In a terminal, the installer continues straight into `snapflow setup`.
USAGE
}

parse_arguments() {
	while [ $# -gt 0 ]; do
		case "$1" in
		--version)
			[ $# -ge 2 ] || fail "$EXIT_USAGE" "--version needs a value" "for example: --version 1.4.0"
			version=$2
			shift 2
			;;
		--version=*)
			version=${1#--version=}
			shift
			;;
		--channel)
			[ $# -ge 2 ] || fail "$EXIT_USAGE" "--channel needs a value" "use stable or beta"
			channel=$2
			shift 2
			;;
		--channel=*)
			channel=${1#--channel=}
			shift
			;;
		--dry-run)
			dry_run=1
			shift
			;;
		--no-setup)
			run_setup=0
			shift
			;;
		--help | -h)
			usage
			exit 0
			;;
		*)
			fail "$EXIT_USAGE" "unknown option: $1" "run with --help to see the options"
			;;
		esac
	done
	case "$channel" in
	stable | beta) ;;
	*) fail "$EXIT_USAGE" "unknown channel: $channel" "use stable or beta" ;;
	esac
	if [ -n "$version" ]; then
		version=${version#v}
		is_version "$version" || fail "$EXIT_USAGE" "invalid version: $version" "use a release version such as 1.4.0"
	fi
}

is_version() {
	printf '%s\n' "$1" | grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
}

run() {
	if [ "$dry_run" -eq 1 ]; then
		say "+ ${sudo_command:+$sudo_command }$*"
		return 0
	fi
	${sudo_command:+"$sudo_command"} "$@"
}

check_platform() {
	kernel=$(uname -s)
	[ "$kernel" = "Linux" ] || fail "$EXIT_UNSUPPORTED" "Snapflow machines need Linux, not $kernel" \
		"run this installer on a Linux machine with KVM"
	machine="${SNAPFLOW_INSTALL_ARCH:-$(uname -m)}"
	case "$machine" in
	x86_64 | amd64) architecture="amd64" ;;
	aarch64 | arm64) architecture="arm64" ;;
	*) fail "$EXIT_UNSUPPORTED" "unsupported CPU architecture: $machine" "Snapflow supports amd64 (x86_64) and arm64 (aarch64)" ;;
	esac
	step "Linux on $machine"
}

check_kvm() {
	if [ ! -e "$KVM_DEVICE" ]; then
		fail "$EXIT_UNSUPPORTED" "KVM is not available ($KVM_DEVICE is missing)" \
			"enable hardware virtualization (Intel VT-x or AMD-V) in the firmware" \
			"load the module: sudo modprobe kvm_intel  (or kvm_amd)" \
			"on a cloud VM, choose an instance type with nested virtualization"
	fi
	step "KVM is available at $KVM_DEVICE"
}

check_systemd() {
	[ -d "$SYSTEMD_DIRECTORY" ] || fail "$EXIT_UNSUPPORTED" "systemd is not running" \
		"Snapflow runs as a systemd service; use a distribution booted with systemd"
	step "systemd is running"
}

check_tools() {
	command -v curl >/dev/null 2>&1 || fail "$EXIT_UNSUPPORTED" "curl is required" "install curl and rerun the installer"
	command -v tar >/dev/null 2>&1 || fail "$EXIT_UNSUPPORTED" "tar is required" "install tar and rerun the installer"
	if command -v sha256sum >/dev/null 2>&1; then
		hash_command="sha256sum"
	elif command -v shasum >/dev/null 2>&1; then
		hash_command="shasum -a 256"
	else
		fail "$EXIT_UNSUPPORTED" "sha256sum or shasum is required" "install coreutils and rerun the installer"
	fi
}

select_privilege() {
	if [ "$(id -u)" -eq 0 ]; then
		sudo_command=""
	elif command -v sudo >/dev/null 2>&1; then
		sudo_command="sudo"
	elif [ "$dry_run" -eq 1 ]; then
		sudo_command="sudo"
	else
		fail "$EXIT_PERMISSION" "installing Snapflow needs root" "rerun as root, or install sudo"
	fi
}

fetch() {
	curl --proto "$curl_protocols" --tlsv1.2 -fsSL --retry 3 -o "$2" "$1"
}

resolve_version() {
	if [ -n "$version" ]; then
		return
	fi
	latest=$(curl --proto "$curl_protocols" --tlsv1.2 -fsSLI --retry 3 -o /dev/null -w '%{url_effective}' "$BASE_URL/latest") ||
		fail "$EXIT_DOWNLOAD" "cannot find the latest Snapflow release at $BASE_URL/latest" \
			"check the network connection, or pass --version X.Y.Z"
	version=${latest##*/}
	version=${version#v}
	is_version "$version" || fail "$EXIT_DOWNLOAD" "no stable Snapflow release is published yet" \
		"pass --version X.Y.Z to install a beta release"
}

cleanup() {
	if [ -n "$work_directory" ]; then
		rm -rf -- "$work_directory"
	fi
}

download_release() {
	archive="snapflow-$version-linux-$architecture.tar.gz"
	release_url="$BASE_URL/download/v$version"
	work_directory=$(mktemp -d)
	trap cleanup EXIT
	trap 'exit 130' INT
	trap 'exit 143' TERM
	fetch "$release_url/$archive" "$work_directory/$archive" ||
		fail "$EXIT_DOWNLOAD" "cannot download $release_url/$archive" "check that Snapflow $version exists for $architecture"
	fetch "$release_url/SHA256SUMS" "$work_directory/SHA256SUMS" ||
		fail "$EXIT_DOWNLOAD" "cannot download $release_url/SHA256SUMS"
	step "Downloaded Snapflow $version for $architecture"
}

verify_release() {
	if command -v cosign >/dev/null 2>&1; then
		fetch "$release_url/SHA256SUMS.sigstore.json" "$work_directory/SHA256SUMS.sigstore.json" ||
			fail "$EXIT_DOWNLOAD" "cannot download $release_url/SHA256SUMS.sigstore.json"
		cosign verify-blob \
			--bundle "$work_directory/SHA256SUMS.sigstore.json" \
			--certificate-identity-regexp "$SIGNER_IDENTITY" \
			--certificate-oidc-issuer "$SIGNER_ISSUER" \
			"$work_directory/SHA256SUMS" >/dev/null 2>&1 ||
			fail "$EXIT_VERIFY" "the SHA256SUMS signature does not verify" "do not install this download; report it at https://github.com/snapflowio/snapflow/security"
		step "Signature verified with cosign"
	else
		note "cosign not found; skipped the signature check (checksums are still verified)"
	fi
	expected=$(awk -v name="$archive" '$2 == name || $2 == "*" name { print $1; exit }' "$work_directory/SHA256SUMS")
	[ -n "$expected" ] || fail "$EXIT_VERIFY" "SHA256SUMS does not list $archive"
	actual=$($hash_command "$work_directory/$archive" | awk '{ print $1 }')
	[ "$actual" = "$expected" ] || fail "$EXIT_VERIFY" "checksum mismatch for $archive" \
		"expected $expected" "received $actual" "do not install this download; try again later"
	step "Checksum verified"
	tar -xzf "$work_directory/$archive" -C "$work_directory" snapflow ||
		fail "$EXIT_VERIFY" "$archive does not contain the snapflow binary"
	[ -f "$work_directory/snapflow" ] || fail "$EXIT_VERIFY" "$archive does not contain the snapflow binary"
}

install_binary() {
	run mkdir -p "$BIN_DIRECTORY"
	run install -m 0755 -o 0 -g 0 "$work_directory/snapflow" "$STAGING_PATH"
	run mv -f "$STAGING_PATH" "$INSTALL_PATH"
}

has_terminal() {
	[ -t 1 ] && [ -r "$TERMINAL_DEVICE" ] && (: <"$TERMINAL_DEVICE") 2>/dev/null
}

next_step() {
	say ""
	say "${style_brand}◆ snapflow${style_reset} $version is installed at $INSTALL_PATH."
	if [ "$run_setup" -eq 1 ] && [ "$dry_run" -eq 0 ] && has_terminal; then
		say ""
		run "$INSTALL_PATH" setup --channel "$channel" <"$TERMINAL_DEVICE"
		return
	fi
	if [ "$channel" = "stable" ]; then
		say "Next: sudo snapflow setup"
	else
		say "Next: sudo snapflow setup --channel $channel"
	fi
}

main() {
	init_settings
	init_style
	parse_arguments "$@"
	say "${style_brand}◆ snapflow${style_reset} installer ${style_muted}· $channel channel${style_reset}"
	check_platform
	check_kvm
	check_systemd
	check_tools
	select_privilege
	resolve_version
	download_release
	verify_release
	install_binary
	next_step
}

main "$@"
