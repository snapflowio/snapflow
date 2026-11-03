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

const (
	GroupStart    = "start"
	GroupOperate  = "operate"
	GroupMaintain = "maintain"
	GroupAdvanced = "advanced"

	GroupStartTitle    = "Get started:"
	GroupOperateTitle  = "Operate:"
	GroupMaintainTitle = "Maintain:"
	GroupAdvancedTitle = "Advanced:"
)

func HelpRoot() Help {
	return Help{
		Use:   Binary,
		Short: "List this machine on the Snapflow compute marketplace",
		Long: `snapflow lists this Linux machine on the Snapflow compute marketplace, where it
	earns USD by hosting isolated microVM sandboxes.

	Get started:
	  sudo snapflow setup

	Pricing, listing, and payouts are managed in the Snapflow dashboard.
	Commands that need root ask for sudo when run in a terminal. Every flag can
	also be set with a SNAPFLOW_* environment variable, for example
	SNAPFLOW_YES=true for --yes.`,
	}
}

func HelpSetup() Help {
	return Help{
		Use:   "setup",
		Short: "Check this machine, approve it, and start earning",
		Long: `Setup walks through everything a new machine needs:

	  1. machine checks: KVM, nftables, IPv4 forwarding, filesystem tools,
	     cgroup v2, and disk space
	  2. the verified Snapflow release
	  3. approval in the Snapflow dashboard, with a one-time code and QR code,
	     then registration into --organization or your active organization;
	     Snapflow detects where the machine is from its IP address
	  4. the system service, started now and on every boot

	Setup is safe to rerun: completed steps are kept. If the dashboard revoked or
	deleted this machine, or you reinstalled it, rerun with --replace: after you
	approve the new code, setup revokes the previous registration and registers
	the machine again under the same name, keeping its history.

	Without a terminal, or with --yes, setup never prompts.`,
		Example: `  sudo snapflow setup
	  sudo snapflow setup --yes --name rack-04
	  sudo snapflow setup --organization acme
	  sudo snapflow setup --replace`,
	}
}

func HelpStatus() Help {
	return Help{
		Use:   "status",
		Short: "Show health, scheduling, sandboxes, resources, payouts, and updates",
		Long: `Status shows this machine as both the local daemon and the Snapflow control
	plane see it: its identity, state, whether it accepts sandboxes, running
	sandboxes, resource use, payout readiness, edge and runtime health, the
	installed release and update state, and recent service errors. It exits
	non-zero when the machine is not ready.`,
		Example: `  sudo snapflow status
	  sudo snapflow status --watch
	  sudo snapflow status --json | jq .controlPlane.state`,
	}
}

func HelpDoctor() Help {
	return Help{
		Use:   "doctor",
		Short: "Diagnose machine readiness and explain how to fix each problem",
		Long: `Doctor runs every readiness check without changing the machine and prints a
	fix for each one that fails. It exits non-zero when a required check fails.

	With --isolation it also builds two throwaway sandbox networks with stand-in
	guests and proves every network boundary holds. Stop Snapflow first: the probe
	refuses to run while sandboxes exist, and Snapflow restores its host rules on
	start.`,
		Example: `  sudo snapflow doctor
	  sudo snapflow doctor --json
	  sudo snapflow doctor --isolation`,
	}
}

func HelpLogs() Help {
	return Help{
		Use:   "logs",
		Short: "Show Snapflow service logs",
		Example: `  sudo snapflow logs --follow
	  sudo snapflow logs --json`,
	}
}

func HelpStart() Help { return Help{Use: "start", Short: "Start the Snapflow service"} }

func HelpStop() Help { return Help{Use: "stop", Short: "Stop the Snapflow service"} }

func HelpUpdate() Help {
	return Help{
		Use:   "update",
		Short: "Update to the newest verified Snapflow release",
		Long: `Update checks the signed release channel and, when a newer release exists,
	asks to apply it. Applying drains running sandboxes, activates the new release
	atomically, and waits for the machine to report ready, restoring the previous
	release if it does not. Updates also apply automatically during the
	maintenance window.`,
		Example: `  sudo snapflow update
	  sudo snapflow update --check
	  sudo snapflow update --yes`,
	}
}

func HelpRollback() Help {
	return Help{
		Use:     "rollback",
		Short:   "Drain sandboxes and return to the previous verified release",
		Example: `  sudo snapflow rollback`,
	}
}

func HelpUninstall() Help {
	return Help{
		Use:   "uninstall",
		Short: "Stop the Snapflow service and optionally erase its state",
		Example: `  sudo snapflow uninstall
	  sudo snapflow uninstall --purge`,
	}
}

func HelpBenchmark() Help {
	return Help{
		Use:   "benchmark",
		Short: "Measure release verification, storage, and API latency",
	}
}

func HelpRelease() Help {
	return Help{
		Use:   "release",
		Short: "Inspect the verified Snapflow releases on this machine",
	}
}

func HelpReleaseVerify() Help {
	return Help{Use: "verify", Short: "Cryptographically verify the active Snapflow release"}
}

func HelpReleaseStatus() Help {
	return Help{Use: "status", Short: "Show the active, previous, and staged releases"}
}

func HelpReleaseGC() Help {
	return Help{Use: "gc", Short: "Remove inactive verified releases and abandoned staging data"}
}

func HelpReleaseInstall() Help {
	return Help{Use: "install", Short: "Install and atomically activate the profile's Snapflow release"}
}

func HelpReleaseReset() Help {
	return Help{Use: "reset", Short: "Remove only the isolated local-development Snapflow release state"}
}
