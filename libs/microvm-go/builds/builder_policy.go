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
package builds

import "time"

const (
	builderIdleTimeout        = 5 * time.Minute
	builderReapInterval       = time.Minute
	builderStopTimeout        = 30 * time.Second
	builderStateRetention     = 7 * 24 * time.Hour
	builderStateDiskLimit     = 16
	builderDaemonReadyTimeout = 30 * time.Second
	builderDaemonProbeTimeout = 2 * time.Second
	builderDaemonPollInterval = 50 * time.Millisecond
	builderTenantKeyBytes     = 16

	builderDaemonPort         uint16 = 1234
	builderDaemonAddress             = "tcp://127.0.0.1:1234"
	builderDaemonBinary              = "/usr/bin/buildkitd"
	builderDaemonConfig              = "/etc/buildkit/buildkitd.toml"
	builderStateMount                = "/var/lib/buildkit"
	builderSnapshotter               = "overlayfs"
	builderMaxUsedSpace              = "80%"
	builderStateDirPermission        = 0o700
)

func builderDaemonCommand() []string {
	return []string{
		builderDaemonBinary,
		"--addr", builderDaemonAddress,
		"--config", builderDaemonConfig,
		"--root", builderStateMount,
		"--oci-worker-snapshotter", builderSnapshotter,
	}
}
