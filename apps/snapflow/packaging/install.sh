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
	CPUINFO_PATH="/proc/cpuinfo"
	LSM_PATH="/sys/kernel/security/lsm"
	PCI_DEVICES="/sys/bus/pci/devices"
	IOMMU_GROUPS="/sys/kernel/iommu_groups"
	NVIDIA_VENDOR="0x10de"
	DISPLAY_CLASS_PREFIX="0x03"
	DATA_DIRECTORY="/var/lib/snapflow"
	MINIMUM_KERNEL_MAJOR=6
	MINIMUM_KERNEL_MINOR=2
	MINIMUM_FREE_GIB=10
	KIB_PER_GIB=1048576
	ADD_MACHINE_URL="https://snapflow.io/dashboard/machines/add"
	SIGNER_IDENTITY='^https://github\.com/snapflowio/snapflow/\.github/workflows/release\.yml@refs/heads/main$'
	SIGNER_ISSUER="https://token.actions.githubusercontent.com"
	TOKEN_ENVIRONMENT="SNAPFLOW_ENROLLMENT_TOKEN"
	EXIT_USAGE=2
	EXIT_UNSUPPORTED=3
	EXIT_VERIFY=65
	EXIT_DOWNLOAD=69
	EXIT_PERMISSION=77

	version="${SNAPFLOW_VERSION:-}"
	channel="${SNAPFLOW_CHANNEL:-stable}"
	token="${SNAPFLOW_ENROLLMENT_TOKEN:-}"
	dry_run=0
	cli_only=0
	positional_token=
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
Install Snapflow and enroll this machine.

Usage: install.sh [KEY] [--version X.Y.Z] [--channel stable|beta] [--cli-only] [--dry-run]

  KEY               enrollment key from the dashboard's Add machine page; also
                    --token KEY or SNAPFLOW_ENROLLMENT_TOKEN for scripted installs
  --version X.Y.Z   install this release instead of the latest stable one (SNAPFLOW_VERSION)
  --channel NAME    release channel: stable or beta (SNAPFLOW_CHANNEL)
  --cli-only        install only the verified snapflow command, for example on an edge host
  --dry-run         download and verify, then print every change instead of making it
  --help            show this help

With a key, the installer enrolls the machine and starts the Snapflow service
without prompting. Rerunning it on an enrolled machine keeps its enrollment.
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
		--token)
			[ $# -ge 2 ] || fail "$EXIT_USAGE" "--token needs a value" "copy the install command from the dashboard's Add machine page"
			token=$2
			shift 2
			;;
		--token=*)
			token=${1#--token=}
			shift
			;;
		--cli-only)
			cli_only=1
			shift
			;;
		--dry-run)
			dry_run=1
			shift
			;;
		--help | -h)
			usage
			exit 0
			;;
		-*)
			fail "$EXIT_USAGE" "unknown option: $1" "run with --help to see the options"
			;;
		*)
			[ -z "$positional_token" ] || fail "$EXIT_USAGE" "only one enrollment key is accepted" "copy the install command from the dashboard's Add machine page"
			positional_token=1
			token=$1
			shift
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

check_kernel() {
	release=$(uname -r)
	major=$(printf '%s\n' "$release" | cut -d. -f1)
	minor=$(printf '%s\n' "$release" | cut -d. -f2 | sed 's/[^0-9].*//')
	if [ "${major:-0}" -lt "$MINIMUM_KERNEL_MAJOR" ] ||
		{ [ "$major" -eq "$MINIMUM_KERNEL_MAJOR" ] && [ "${minor:-0}" -lt "$MINIMUM_KERNEL_MINOR" ]; }; then
		fail "$EXIT_UNSUPPORTED" "Linux $release is too old; Snapflow needs Linux $MINIMUM_KERNEL_MAJOR.$MINIMUM_KERNEL_MINOR or newer" \
			"sandboxes are confined with Landlock ABI v3, which Linux $MINIMUM_KERNEL_MAJOR.$MINIMUM_KERNEL_MINOR added" \
			"upgrade the kernel (Ubuntu 24.04 ships 6.8), reboot, and rerun the installer"
	fi
	if [ -r "$LSM_PATH" ] && ! tr ',' '\n' <"$LSM_PATH" | grep -qx landlock; then
		fail "$EXIT_UNSUPPORTED" "Landlock is built into Linux $release but not enabled (active: $(cat "$LSM_PATH"))" \
			"add landlock to the lsm= kernel parameter, keeping the active list: lsm=landlock,$(cat "$LSM_PATH")" \
			"set it in GRUB_CMDLINE_LINUX_DEFAULT in /etc/default/grub, run sudo update-grub, reboot, and rerun the installer"
	fi
	step "Kernel $release"
}

cpu_flags() {
	grep -m 1 '^flags' "$CPUINFO_PATH" 2>/dev/null || true
}

check_kvm() {
	if [ -e "$KVM_DEVICE" ]; then
		step "KVM is available at $KVM_DEVICE"
		return
	fi
	flags=$(cpu_flags)
	if printf '%s\n' "$flags" | grep -qwE 'vmx|svm'; then
		fail "$EXIT_UNSUPPORTED" "KVM is not loaded: $KVM_DEVICE is missing, although the CPU supports virtualization" \
			"load the module: sudo modprobe kvm_intel  (or kvm_amd on AMD)" \
			"load it on every boot: echo kvm_intel | sudo tee /etc/modules-load.d/kvm.conf  (or kvm_amd)" \
			"then rerun the installer"
	elif [ -n "$flags" ]; then
		fail "$EXIT_UNSUPPORTED" "hardware virtualization is off: $KVM_DEVICE is missing and the CPU reports no vmx or svm flag" \
			"enable Intel VT-x or AMD-V (SVM) in the BIOS/UEFI settings and reboot" \
			"on a cloud VM, choose an instance type with nested virtualization" \
			"then rerun the installer"
	fi
	fail "$EXIT_UNSUPPORTED" "KVM is not available: $KVM_DEVICE is missing" \
		"enable hardware virtualization in the firmware and load the kvm module" \
		"on a cloud VM, choose an instance type with nested virtualization"
}

check_disk() {
	target=$DATA_DIRECTORY
	while [ ! -d "$target" ]; do
		target=$(dirname "$target")
	done
	available_kib=$(df -Pk "$target" | awk 'NR == 2 { print $4 }')
	mount_point=$(df -Pk "$target" | awk 'NR == 2 { print $6 }')
	available_gib=$((available_kib / KIB_PER_GIB))
	if [ "$available_gib" -lt "$MINIMUM_FREE_GIB" ]; then
		fail "$EXIT_UNSUPPORTED" "only $available_gib GiB free on $mount_point, which holds $DATA_DIRECTORY; Snapflow needs at least $MINIMUM_FREE_GIB GiB" \
			"free space on $mount_point, or mount a larger disk at $DATA_DIRECTORY" \
			"XFS with reflink=1 or Btrfs there makes sandbox starts faster"
	fi
	step "$available_gib GiB free on $mount_point for $DATA_DIRECTORY"
}

nvidia_gpu() {
	for device in "$PCI_DEVICES"/*; do
		if [ ! -r "$device/vendor" ] || [ ! -r "$device/class" ]; then
			continue
		fi
		if [ "$(cat "$device/vendor")" = "$NVIDIA_VENDOR" ]; then
			case "$(cat "$device/class")" in
			"$DISPLAY_CLASS_PREFIX"*)
				basename "$device"
				return 0
				;;
			esac
		fi
	done
	return 1
}

check_gpu() {
	gpu=$(nvidia_gpu) || return 0
	if [ -z "$(ls -A "$IOMMU_GROUPS" 2>/dev/null)" ]; then
		fail "$EXIT_UNSUPPORTED" "the NVIDIA GPU at $gpu needs the IOMMU, which is off" \
			"enable VT-d (Intel) or AMD-Vi / IOMMU (AMD) in the BIOS/UEFI settings" \
			"boot with intel_iommu=on iommu=pt  (or amd_iommu=on iommu=pt): add it to GRUB_CMDLINE_LINUX_DEFAULT in /etc/default/grub, run sudo update-grub, reboot" \
			"then rerun the installer; enrollment checks the GPU's passthrough drivers next"
	fi
	step "NVIDIA GPU at $gpu with the IOMMU on"
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
	step "Installed $INSTALL_PATH"
}

installed_version() {
	[ -x "$INSTALL_PATH" ] || return 1
	current=$("$INSTALL_PATH" --version 2>/dev/null | awk '{ print $NF }') || return 1
	printf '%s\n' "${current#v}"
}

install_release() {
	if [ "$(installed_version || true)" = "$version" ]; then
		step "Snapflow $version is already installed at $INSTALL_PATH"
		return
	fi
	download_release
	verify_release
	install_binary
}

section() {
	say ""
	say "${style_brand}$*${style_reset}"
}

enroll_machine() {
	say ""
	say "${style_brand}◆ snapflow${style_reset} $version is installed at $INSTALL_PATH."
	if [ -z "$token" ]; then
		channel_flag=""
		[ "$channel" = "stable" ] || channel_flag=" --channel $channel"
		say "Next: sudo snapflow enroll <key>$channel_flag"
		note "create the key on the dashboard's Add machine page: $ADD_MACHINE_URL"
		note "already enrolled? sudo snapflow enroll$channel_flag needs no key and keeps the enrollment"
		return
	fi
	say ""
	preserve_token=""
	[ -z "$sudo_command" ] || preserve_token="--preserve-env=$TOKEN_ENVIRONMENT"
	if [ "$dry_run" -eq 1 ]; then
		say "+ $TOKEN_ENVIRONMENT=<redacted> ${sudo_command:+$sudo_command $preserve_token }$INSTALL_PATH enroll --channel $channel"
		return
	fi
	SNAPFLOW_ENROLLMENT_TOKEN=$token
	export SNAPFLOW_ENROLLMENT_TOKEN
	${sudo_command:+"$sudo_command"} ${preserve_token:+"$preserve_token"} "$INSTALL_PATH" enroll --channel "$channel" </dev/null
}

main() {
	init_settings
	init_style
	parse_arguments "$@"
	say "${style_brand}◆ snapflow${style_reset} installer ${style_muted}· $channel channel${style_reset}"
	section "Checking this machine"
	check_platform
	check_systemd
	check_tools
	if [ "$cli_only" -eq 0 ]; then
		check_kernel
		check_kvm
		check_disk
		check_gpu
	fi
	select_privilege
	section "Installing the snapflow command"
	resolve_version
	install_release
	if [ "$cli_only" -eq 0 ]; then
		enroll_machine
	fi
}

main "$@"
