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

package firecracker

import (
	"context"

	"github.com/snapflowio/microvm-go/hypervisor"
)

const (
	restoreConcurrency = 4
	serialConsole      = "ttyS0"
	vmmName            = "firecracker"
)

type Backend struct{}

func NewBackend() Backend {
	return Backend{}
}

func (Backend) Capabilities() hypervisor.Capabilities {
	return hypervisor.Capabilities{
		Snapshots:           true,
		SerialConsole:       serialConsole,
		DisableLegacySerial: true,
		RestoreConcurrency:  restoreConcurrency,
	}
}

func (Backend) Start(ctx context.Context, cfg hypervisor.VM) (hypervisor.Process, error) {
	if err := validateDisks(cfg.Disks); err != nil {
		return hypervisor.Process{}, err
	}
	return hypervisor.LaunchVMM(ctx, cfg, hypervisor.LaunchSpec{Name: vmmName, Arguments: vmmArguments(cfg), Initialize: func() error {
		return newClient(cfg.SocketPath).ConfigureAndStart(ctx, cfg)
	}})
}

func (Backend) Restore(ctx context.Context, cfg hypervisor.VM, snapshotPath string) (hypervisor.Process, error) {
	if err := validateDisks(cfg.Disks); err != nil {
		return hypervisor.Process{}, err
	}
	return hypervisor.LaunchVMM(ctx, cfg, hypervisor.LaunchSpec{Name: vmmName, Arguments: vmmArguments(cfg), ReadOnly: []string{snapshotPath}, Initialize: func() error {
		return newClient(cfg.SocketPath).LoadSnapshot(ctx, snapshotPath, cfg)
	}})
}

func (Backend) Pause(ctx context.Context, socketPath string) error {
	return newClient(socketPath).Pause(ctx)
}

func (Backend) Resume(ctx context.Context, socketPath string) error {
	return newClient(socketPath).Resume(ctx)
}

func (Backend) Info(ctx context.Context, socketPath string) (hypervisor.VMInfo, error) {
	return newClient(socketPath).Info(ctx)
}

func (Backend) Snapshot(ctx context.Context, socketPath, destination string) error {
	return newClient(socketPath).Snapshot(ctx, destination)
}

func (Backend) Shutdown(context.Context, string) error {
	return nil
}

// vmmArguments keep Firecracker's default seccomp filters; the jail supplies
// every other confinement.
func vmmArguments(cfg hypervisor.VM) []string {
	return []string{"--api-sock", cfg.SocketPath, "--id", cfg.ID}
}
