// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package text

const (
	FlagProfile          = "deployment profile: production or development"
	FlagJSON             = "print stable JSON instead of plain text"
	FlagYes              = "confirm without a prompt"
	FlagToken            = "enrollment key from the dashboard's Add machine page (also SNAPFLOW_ENROLLMENT_TOKEN)"
	FlagAPIURL           = "control-plane API URL; defaults to the selected profile's API"
	FlagName             = "machine name shown in the dashboard; defaults to the hostname"
	FlagChannel          = "release channel to install: stable or beta; defaults to stable"
	FlagUpdateChannel    = "release channel to follow: stable or beta; defaults to the installed release's channel"
	FlagScheduled        = "apply only inside the machine's maintenance window, as the update timer does"
	FlagPurge            = "also erase the machine's identity, keys and workloads"
	FlagSamples          = "benchmark sample count from 5 through 100"
	FlagBenchmark        = "also measure release verification, storage and API latency"
	FlagRepositoryOrigin = "development loopback TUF origin"
	FlagBootstrapRoot    = "development TUF bootstrap root"
	FlagOfferedVCPUs     = "most vCPUs this machine offers until the host sets an offer in the dashboard; 0 offers all admittable vCPUs"
	FlagOfferedMemory    = "most memory GiB this machine offers until the host sets an offer in the dashboard; 0 offers all admittable memory"
	FlagOfferedDisk      = "most disk GiB this machine offers until the host sets an offer in the dashboard; 0 offers all admittable disk"
	FlagTemplateUnused   = "longest a runtime template may stay unused before Snapflow deletes it, unless the control plane still wants it"
	FlagIsolation        = "also run the live sandbox isolation probe; Snapflow must be stopped"
	FlagMaxUnclaimed     = "most signed but unclaimed value a payment channel may carry before its sandboxes are held, until the host sets one in the dashboard, " +
		"in USDC base units (1 USDC = 1000000)"
)
