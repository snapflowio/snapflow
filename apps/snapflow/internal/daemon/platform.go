// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"os"

	"github.com/snapflowio/microvm-go/host"
	"github.com/snapflowio/snapflow/internal/inventory"
	"github.com/snapflowio/snapflow/internal/release"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/runtime/microvm"
	"github.com/snapflowio/snapflow/internal/state"
	"github.com/snapflowio/snapflow/internal/telemetry"
	"github.com/snapflowio/snapflow/internal/tunnel"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const hostRootDirectory = "/"

type Runtime interface {
	sandboxruntime.SandboxRuntime
	sandboxruntime.UsageSampler
	telemetry.RuntimeSource
	tunnel.RuntimeTargetDialer
}

type Engine interface {
	Component
	Runtime() Runtime
}

type HostInventory func(context.Context) (*machinev1alpha1.HostInventory, error)

type (
	ReleaseLoader func(installationRoot string) (release.VerifiedRelease, error)
	Preflight     func(dataDirectory, mkfsErofsPath string) (host.PreflightReport, error)
	VaultOpener   func(stateDirectory string) (state.Vault, error)
	HostProbe     func(context.Context) (host.HostGPUInfo, HostInventory)
	RuntimeOpener func(context.Context, microvm.EngineConfig) (Engine, error)
)

type platform struct {
	loadRelease ReleaseLoader
	preflight   Preflight
	openVault   VaultOpener
	probeHost   HostProbe
	openRuntime RuntimeOpener
}

func hostPlatform() platform {
	return platform{
		loadRelease: loadActiveRelease,
		preflight:   hostPreflight,
		openVault:   state.NewPlatformVault,
		probeHost:   probeHost,
		openRuntime: openMicroVMEngine,
	}
}

func loadActiveRelease(installationRoot string) (release.VerifiedRelease, error) {
	return release.LoadActive(installationRoot, true)
}

func hostPreflight(dataDirectory, mkfsErofsPath string) (host.PreflightReport, error) {
	return microvm.HostPreflight(dataDirectory, mkfsErofsPath)
}

func probeHost(ctx context.Context) (host.HostGPUInfo, HostInventory) {
	gpus := host.DetectHostGPUs(ctx)
	uuids := make([]string, 0, len(gpus.Devices))
	for _, device := range gpus.Devices {
		uuids = append(uuids, device.UUID)
	}
	return gpus, inventory.NewCollector(inventory.Sources{System: os.DirFS(hostRootDirectory), GPUUUIDs: uuids})
}

type microVMEngine struct {
	engine *microvm.Engine
}

func openMicroVMEngine(ctx context.Context, cfg microvm.EngineConfig) (Engine, error) {
	engine, err := microvm.Open(ctx, cfg)
	if err != nil {
		return nil, err
	}
	return microVMEngine{engine: engine}, nil
}

func (adapter microVMEngine) Run(ctx context.Context) error {
	return adapter.engine.Run(ctx)
}

func (adapter microVMEngine) Runtime() Runtime {
	return adapter.engine.Runtime
}
