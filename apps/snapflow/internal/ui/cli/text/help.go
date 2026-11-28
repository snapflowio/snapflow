// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package text

type Help struct {
	Use     string
	Short   string
	Long    string
	Example string
}

func HelpRoot() Help {
	return Help{
		Use:   Binary,
		Short: "Run this machine as a Snapflow host",
		Long: `snapflow runs this Linux machine as a Snapflow host: it hosts isolated microVM
sandboxes and earns USDC for them.

Add the machine on the dashboard's Host mode "Add machine" page, which shows
the install command with an enrollment key. Rates, listing, maintenance
windows, benchmarks, diagnostics, earnings and payouts are all managed in the
dashboard. Updates install automatically and logs go to journald
(journalctl -u snapflow).

Start with "sudo snapflow status": it lists what still stands between this
machine and earnings, and the dashboard page or command that fixes each item.

Commands that need root ask for sudo when run in a terminal. Every flag can
also be set with a SNAPFLOW_* environment variable.

Exit status: 0 success or ready, 1 failed or not ready, 2 usage or
configuration error, 77 needs root.`,
	}
}

func HelpEnroll() Help {
	return Help{
		Use:   "enroll [key]",
		Short: "Enroll this machine with a dashboard enrollment key and start the service",
		Long: `Enroll prepares this machine and links it to your organization:

  1. machine checks: KVM, nftables, IPv4 forwarding, filesystem tools,
     cgroup v2, systemd, disk space, Landlock, KSM and, with an NVIDIA GPU,
     IOMMU and passthrough drivers; each failure prints its fix
  2. the verified Snapflow release
  3. enrollment with the key from the dashboard's Add machine page; the
     machine generates its identity key and its host key, which receives
     its earnings on chain and never leaves the machine
  4. the system service, started now and on every boot, with automatic updates

Enroll never prompts and is safe to rerun: an enrolled machine keeps its
identity and no key is needed. The dashboard then shows the machine's
progress: connected, benchmarking, awaiting approval and listed; run
"sudo snapflow status" to see what is still missing.`,
		Example: `  sudo snapflow enroll <key>
  sudo SNAPFLOW_ENROLLMENT_TOKEN=<key> snapflow enroll --name rack-04`,
	}
}

func HelpStatus() Help {
	return Help{
		Use:   "status",
		Short: "Show this machine's health and why it is or isn't earning",
		Long: `Status reads this machine's enrollment, the local service, the installed
release and update state, payment holds and recent service errors without the
network, and adds the control plane's view when it can reach it.

It ends with an Earning checklist: service, release, control-plane
connection, qualification, marketplace listing and payouts. Each item that
blocks earnings names what is wrong and the command or dashboard page that
fixes it. Status exits non-zero when the machine itself is not ready.`,
		Example: `  sudo snapflow status
  sudo snapflow status --json | jq .registration`,
	}
}

func HelpDoctor() Help {
	return Help{
		Use:   "doctor",
		Short: "Check KVM, GPU, disk and network readiness and explain each fix",
		Long: `Doctor runs every readiness check without changing the machine and prints a
fix for each one that fails. It exits non-zero when a required check fails.

With --isolation it also builds two throwaway sandbox networks with stand-in
guests and proves every network boundary holds. Stop Snapflow first: the probe
refuses to run while sandboxes exist, and Snapflow restores its host rules on
start.

With --benchmark it also measures release verification, storage throughput
and API latency, and keeps the report for the benchmark check.`,
		Example: `  sudo snapflow doctor
  sudo snapflow doctor --json
  sudo snapflow doctor --isolation
  sudo snapflow doctor --benchmark --samples 20`,
	}
}

func HelpUninstall() Help {
	return Help{
		Use:   "uninstall",
		Short: "Stop the Snapflow service and optionally erase its state",
		Long: `Uninstall stops and disables the Snapflow service and update timer, ends
running sandboxes and removes the installed releases and the snapflow command.
The machine keeps its identity, so rerunning the install command brings it
back without a new key.

With --purge it also erases the machine's identity, keys and workloads; remove
the machine in the dashboard afterwards. Both forms are safe to rerun.`,
		Example: `  sudo snapflow uninstall
  sudo snapflow uninstall --purge`,
	}
}

func HelpUpdate() Help {
	return Help{Use: "update", Short: "Apply the newest verified release; run by the update timer"}
}

func HelpRelease() Help {
	return Help{Use: "release", Short: "Manage the verified Snapflow releases on this machine"}
}

func HelpReleaseVerify() Help {
	return Help{Use: "verify", Short: "Cryptographically verify the active Snapflow release"}
}

func HelpReleaseInstall() Help {
	return Help{Use: "install", Short: "Install and atomically activate the profile's Snapflow release"}
}

func HelpReleaseReset() Help {
	return Help{Use: "reset", Short: "Remove only the isolated local-development Snapflow release state"}
}
