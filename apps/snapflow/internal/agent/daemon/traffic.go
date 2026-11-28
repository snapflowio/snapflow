// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"errors"
	"fmt"
	"net/netip"

	"github.com/snapflowio/microvm-go/network"
	"github.com/snapflowio/snapflow/internal/foundation/state"
)

const (
	bytesPerMebibyte = 1024 * 1024
	bitsPerKilobit   = 1000
)

type hostNetworkApplier interface {
	SetTrafficPolicy(context.Context, network.TrafficPolicy) error
	SetPublicAddresses(context.Context, []netip.Addr) error
}

func (daemon *Daemon) setHostNetwork(settings state.HostSettings) {
	daemon.trafficMu.Lock()
	defer daemon.trafficMu.Unlock()
	daemon.traffic = settings.Traffic
	daemon.publicAddresses = settings.PublicAddresses
}

func (daemon *Daemon) bindHostNetwork(ctx context.Context, target hostNetworkApplier) error {
	daemon.trafficMu.Lock()
	daemon.trafficTarget = target
	daemon.trafficMu.Unlock()
	return daemon.applyHostNetwork(ctx)
}

func (daemon *Daemon) applyHostNetwork(ctx context.Context) error {
	daemon.trafficMu.Lock()
	target, settings, addresses := daemon.trafficTarget, daemon.traffic, daemon.publicAddresses
	daemon.trafficMu.Unlock()
	if target == nil {
		return nil
	}
	var failures []error
	if err := target.SetPublicAddresses(ctx, addresses); err != nil {
		failures = append(failures, fmt.Errorf("protect the host's public addresses from sandboxes: %w", err))
	}
	if err := target.SetTrafficPolicy(ctx, trafficPolicy(settings)); err != nil {
		failures = append(failures, fmt.Errorf("apply the sandbox traffic policy: %w", err))
	}
	return errors.Join(failures...)
}

func trafficPolicy(settings *state.TrafficSettings) network.TrafficPolicy {
	if settings == nil {
		return network.TrafficPolicy{}
	}
	return network.TrafficPolicy{
		UploadBPS:               uint64(settings.UploadKbps) * bitsPerKilobit,
		DownloadBPS:             uint64(settings.DownloadKbps) * bitsPerKilobit,
		HostUploadBPS:           uint64(settings.HostUploadKbps) * bitsPerKilobit,
		BurstBytes:              uint64(settings.BurstMiB) * bytesPerMebibyte,
		PacketsPerSecond:        settings.PacketsPerSecond,
		NewConnectionsPerSecond: settings.NewConnectionsPerSecond,
		MaxConnections:          settings.MaxConnections,
		Enforce:                 settings.Enforce,
	}
}
