// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemontest

import (
	"context"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/daemon"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/runtime/microvm"
)

const (
	runtimeServiceName    = "daemontest"
	fakeCapacityCPUs      = 4
	fakeCapacityMemoryGiB = 8
	fakeCapacityDiskGiB   = 24
)

type Runtime struct {
	daemon.Runtime
}

func (Runtime) Health(context.Context) []sandboxruntime.ServiceHealth {
	return []sandboxruntime.ServiceHealth{{Name: runtimeServiceName, Healthy: true}}
}

func (Runtime) Capabilities(context.Context) (sandboxruntime.Capabilities, error) {
	return sandboxruntime.Capabilities{
		KVMAvailable: true, CgroupV2Available: true,
		MachineReleaseVersion: releaseVersion, MachineReleaseDigest: bundleDigest,
	}, nil
}

func (Runtime) RuntimeInventory(context.Context) ([]microvmtypes.RuntimeObservation, error) {
	return nil, nil
}

func (Runtime) AllocatedResources(context.Context) (microvmtypes.AllocatedResources, error) {
	return microvmtypes.AllocatedResources{}, nil
}

func (Runtime) Capacity(context.Context) (microvmtypes.AllocatedResources, error) {
	return microvmtypes.AllocatedResources{CPUVCPUs: fakeCapacityCPUs, MemoryGiB: fakeCapacityMemoryGiB, DiskGiB: fakeCapacityDiskGiB}, nil
}

func (Runtime) ImageCount(context.Context) (int, error) {
	return 0, nil
}

type engine struct {
	runtime Runtime
}

func openEngine(context.Context, microvm.EngineConfig) (daemon.Engine, error) {
	return engine{}, nil
}

func (engine) Run(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

func (fake engine) Runtime() daemon.Runtime {
	return fake.runtime
}
