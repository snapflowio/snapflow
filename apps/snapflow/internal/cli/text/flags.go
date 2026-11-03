// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package text

const (
	FlagNoColor          = "disable colors (also honored: NO_COLOR)"
	FlagProfile          = "deployment profile: production or development"
	FlagJSON             = "print stable JSON instead of formatted text"
	FlagYes              = "never prompt: confirm every question and take answers from flags or SNAPFLOW_* variables"
	FlagAPIURL           = "control-plane API URL; defaults to the selected profile's API"
	FlagName             = "machine name shown in the dashboard; defaults to the hostname"
	FlagOrganization     = "slug or ID of the organization that owns the machine; defaults to your active organization"
	FlagReplace          = "register again, revoking this machine's previous registration"
	FlagWatch            = "keep refreshing until you press q"
	FlagInterval         = "refresh interval for --watch"
	FlagFollow           = "follow new log entries"
	FlagCheck            = "only check for an update; change nothing"
	FlagUpdateChannel    = "release channel to follow: stable or beta; defaults to the installed release's channel"
	FlagSetupChannel     = "release channel to install: stable or beta; defaults to stable"
	FlagPurge            = "also erase registration and workloads"
	FlagSamples          = "sample count from 5 through 100"
	FlagRepositoryOrigin = "development loopback TUF origin"
	FlagBootstrapRoot    = "development TUF bootstrap root"
	FlagOfferedVCPUs     = "most vCPUs this machine offers; 0 offers all admittable vCPUs"
	FlagOfferedMemory    = "most memory GiB this machine offers; 0 offers all admittable memory"
	FlagOfferedDisk      = "most disk GiB this machine offers; 0 offers all admittable disk"
	FlagIsolation        = "also run the live sandbox isolation probe; Snapflow must be stopped"
)
