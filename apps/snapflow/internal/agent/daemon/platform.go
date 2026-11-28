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
	"github.com/snapflowio/snapflow/internal/agent/abuse"
	"github.com/snapflowio/snapflow/internal/agent/inventory"
	"github.com/snapflowio/snapflow/internal/agent/telemetry"
	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/systemd"
	"github.com/snapflowio/snapflow/internal/network/tunnel"
	"github.com/snapflowio/snapflow/internal/supplychain/release"
	sandboxruntime "github.com/snapflowio/snapflow/internal/workloads/runtime"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const hostRootDirectory = "/"

type Runtime interface {
	sandboxruntime.SandboxRuntime
	sandboxruntime.UsageSampler
	abuse.Runtime
	telemetry.RuntimeSource
	tunnel.RuntimeTargetDialer
}

type HostInventory func(context.Context) (*machinev1alpha1.HostInventory, error)

type ServiceRetirer func(context.Context, config.ProfileName) error

type platform struct {
	retire   ServiceRetirer
	notifier systemd.Notifier
}

func hostPlatform() platform {
	return platform{
		retire:   disableServices(systemd.Bus{}),
		notifier: systemd.SocketNotifier{},
	}
}

func loadActiveRelease(installationRoot string) (release.VerifiedRelease, error) {
	return release.LoadActive(installationRoot, true)
}

func probeHost(ctx context.Context) (host.HostGPUInfo, HostInventory) {
	gpus := host.DetectHostGPUs(ctx)
	uuids := make([]string, 0, len(gpus.Devices))
	for _, device := range gpus.Devices {
		uuids = append(uuids, device.UUID)
	}
	return gpus, inventory.NewCollector(inventory.Sources{System: os.DirFS(hostRootDirectory), GPUUUIDs: uuids})
}
