// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package workload

import apiclient "github.com/snapflowio/snapflow/libs/api-client-go"

type (
	SandboxMode       string
	SandboxCapability string
)

const (
	SandboxModeEphemeral SandboxMode = "ephemeral"
	SandboxModeStandard  SandboxMode = "standard"
)

const (
	SandboxCapabilityDeveloperTools = SandboxCapability(apiclient.SandboxCapabilityDeveloperTools)
	SandboxCapabilityDesktop        = SandboxCapability(apiclient.SandboxCapabilityDesktop)
	SandboxCapabilityDirectIO       = SandboxCapability("direct_io")
)

const VolumeFilesystemExt4 = "ext4"

func volumeFilesystems() []string {
	return []string{VolumeFilesystemExt4}
}

func guestCapabilities() []string {
	return []string{string(SandboxCapabilityDeveloperTools), string(SandboxCapabilityDesktop)}
}

func sandboxCapabilities() []string {
	return append(guestCapabilities(), string(SandboxCapabilityDirectIO))
}

func sandboxModes() []string {
	return []string{string(SandboxModeEphemeral), string(SandboxModeStandard)}
}
