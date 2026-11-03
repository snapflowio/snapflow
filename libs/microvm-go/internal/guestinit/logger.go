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

//go:build linux

package guestinit

import (
	"fmt"
	"os"
	"time"
)

type bootPhase string

const (
	bootPhaseEssentialMounts bootPhase = "essential_mounts"
	bootPhaseRootFilesystem  bootPhase = "root_filesystem"
	bootPhaseConfiguration   bootPhase = "configuration"
	bootPhaseNetwork         bootPhase = "network"
	bootPhaseManagedHosts    bootPhase = "managed_hosts"
	bootPhaseBundles         bootPhase = "platform_bundles"
	bootPhaseCgroups         bootPhase = "cgroups"
	bootPhaseVolumes         bootPhase = "volumes"
	bootPhaseRootBindings    bootPhase = "root_bindings"
	bootPhaseChroot          bootPhase = "chroot"
	bootPhaseControl         bootPhase = "control_listener"
	bootPhaseComponents      bootPhase = "platform_components"
	bootPhaseRelays          bootPhase = "service_relays"
	bootPhaseComponentInput  bootPhase = "component_workload"
	bootPhaseWorkload        bootPhase = "workload"
)

func Log(format string, args ...any) {
	line := fmt.Sprintf(format, args...)
	written, err := fmt.Fprintf(os.Stderr, "%s microvm-init: %s\n", time.Now().UTC().Format(time.RFC3339), line)
	if err != nil || written == 0 {
		return
	}
}

func logBootMilestone(bootStarted, phaseStarted time.Time, phase bootPhase, err error) {
	outcome := "ok"
	if err != nil {
		outcome = "error"
	}
	Log(
		"boot milestone phase=%s outcome=%s phase_ms=%d total_ms=%d",
		phase,
		outcome,
		time.Since(phaseStarted).Milliseconds(),
		time.Since(bootStarted).Milliseconds(),
	)
}

func runBootPhase(bootStarted time.Time, phase bootPhase, operation func() error) error {
	phaseStarted := time.Now()
	err := operation()
	logBootMilestone(bootStarted, phaseStarted, phase, err)
	return err
}
