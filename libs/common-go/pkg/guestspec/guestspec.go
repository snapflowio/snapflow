// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package guestspec

import "time"

const BindAddressEnvironment = "SNAPFLOW_GUEST_BIND_ADDRESS"

const AuthHeader = "X-Snapflow-Guest-Token"

const (
	ToolboxService  = "toolbox"
	SSHService      = "ssh"
	TerminalService = "terminal"
	DesktopService  = "desktop"
)

const CredentialRoot = "/run/snapflow/credentials/services"

const LifecycleSocket = "/run/snapflow/components/core.sock"

const LifecycleWorkloadPath = "/v1/workload"

type Workload struct {
	Env map[string]string `json:"env"`
}

const (
	ToolboxCredentialFile  = CredentialRoot + "/" + ToolboxService
	SSHCredentialFile      = CredentialRoot + "/" + SSHService
	TerminalCredentialFile = CredentialRoot + "/" + TerminalService
	DesktopCredentialFile  = CredentialRoot + "/" + DesktopService
)

const (
	ToolboxPort  = 2280
	SSHPort      = 22220
	TerminalPort = 22222
	DesktopPort  = 6080
)

const (
	PlatformMountPath     = "/run/snapflow/platform"
	CoreArtifactName      = "core"
	DesktopArtifactName   = "desktop-extension"
	componentsDirectory   = "components"
	CoreMountPath         = PlatformMountPath + "/" + CoreArtifactName
	DesktopMountPath      = PlatformMountPath + "/" + DesktopArtifactName
	GuestDaemonPath       = CoreMountPath + "/" + componentsDirectory + "/snapflow-guest"
	ComputerUsePluginPath = DesktopMountPath + "/" + componentsDirectory + "/snapflow-desktop"
)

const DesktopAuthUser = "snapflow"

const (
	ComputerUsePluginName        = "snapflow-computer-use"
	ComputerUseProtocolVersion   = 1
	ComputerUseMagicCookieKey    = "SNAPFLOW_COMPUTER_USE_PLUGIN"
	ComputerUseMagicCookieValue  = "snapflow_computer_use"
	ComputerUseSelfCheckArgument = "--snapflow-self-check"
)

const (
	LogFilePath   = "/tmp/snapflow-guest.log"
	LogMaxSizeMB  = 100
	LogMaxBackups = 5
	LogMaxAgeDays = 14
	LogCompress   = true
)

const (
	TerminationCheckInterval = 100 * time.Millisecond
	TerminationGracePeriod   = 5 * time.Second
)
