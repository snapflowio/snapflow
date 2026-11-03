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

package runtime

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"os"
	"time"

	"github.com/snapflowio/microvm-go/healthcheck"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/guestcontrol"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/network"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) UpdateNetworkSettings(ctx context.Context, instanceID string, settings types.NetworkSettings) error {
	guard, err := b.lifecycle.Lock(ctx, instanceID)
	if err != nil {
		return fmt.Errorf("acquire instance lifecycle lock: %w", err)
	}
	defer guard.Release()
	return b.updateNetworkSettingsLocked(ctx, instanceID, settings)
}

func (b *Backend) updateNetworkSettingsLocked(ctx context.Context, instanceID string, settings types.NetworkSettings) error {
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return mvmerrors.NewNotFound(fmt.Errorf("instance %s", instanceID))
		}
		return err
	}
	previous := metadata
	if settings.NetworkBlockAll != nil {
		metadata.RawRequest.NetworkBlockAll = settings.NetworkBlockAll
	}
	if settings.NetworkAllowList != nil {
		metadata.RawRequest.NetworkAllowList = settings.NetworkAllowList
	}
	if settings.EgressBandwidthBPS != nil {
		metadata.RawRequest.EgressBandwidthBPS = settings.EgressBandwidthBPS
	}
	if settings.DomainAllowList != nil {
		metadata.RawRequest.DomainAllowList = settings.DomainAllowList
	}
	policy, err := instanceEgressPolicy(metadata)
	if err != nil {
		return mvmerrors.NewInvalidRequest(err)
	}
	if err := b.networks.ApplyEgressPolicy(ctx, instancePolicyBinding(metadata, policy)); err != nil {
		return fmt.Errorf("apply instance egress policy: %w", err)
	}
	if err := b.writeInstance(metadata); err != nil {
		previousPolicy, policyErr := instanceEgressPolicy(previous)
		if policyErr == nil {
			policyErr = b.networks.ApplyEgressPolicy(context.WithoutCancel(ctx), instancePolicyBinding(previous, previousPolicy))
		}
		return errors.Join(err, wrapOptionalError("restore previous instance egress policy", policyErr))
	}
	return nil
}

func instanceEgressPolicy(metadata state.InstanceMetadata) (network.EgressPolicy, error) {
	return network.NewEgressPolicy(
		metadata.RawRequest.NetworkBlockAll,
		metadata.RawRequest.NetworkAllowList,
		metadata.RawRequest.DomainAllowList,
		metadata.RawRequest.EgressBandwidthBPS,
	)
}

func instancePolicyBinding(metadata state.InstanceMetadata, policy network.EgressPolicy) network.PolicyBinding {
	binding := network.PolicyBinding{InstanceID: metadata.ID, Policy: policy}
	if allocation := metadata.Network; allocation != nil {
		binding.Namespace = allocation.Namespace
		binding.TransitSandbox = allocation.TransitSandbox
		binding.TransitHost = allocation.TransitHost
		binding.DNS = allocation.DNS
	}
	if metadata.LinkedPeer != nil && metadata.LinkedPeer.TransitAddress != "" {
		binding.PeerTransits = []string{metadata.LinkedPeer.TransitAddress}
	}
	return binding
}

func (b *Backend) RuntimeUsageSample(ctx context.Context, instanceID string) (types.RuntimeUsageSample, error) {
	guard, err := b.lifecycle.Lock(ctx, instanceID)
	if err != nil {
		return types.RuntimeUsageSample{}, fmt.Errorf("acquire instance lifecycle lock: %w", err)
	}
	defer guard.Release()
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return types.RuntimeUsageSample{}, mvmerrors.NewNotFound(fmt.Errorf("instance %s", instanceID))
		}
		return types.RuntimeUsageSample{}, err
	}
	sampledAt := time.Now().UTC()
	if err := b.observeNetworkMeter(ctx, &metadata); err != nil {
		return types.RuntimeUsageSample{}, err
	}
	metadata.UsageSequence++
	if metadata.State == types.RuntimeStateStarted && b.processRunning(ctx, metadata) {
		observeRunning(&metadata.RunningMeter, sampledAt)
	}
	if err := b.writeInstance(metadata); err != nil {
		return types.RuntimeUsageSample{}, fmt.Errorf("persist instance usage sequence: %w", err)
	}
	sample := types.RuntimeUsageSample{
		Sequence:             metadata.UsageSequence,
		InternetEgressBytes:  metadata.NetworkMeter.Totals.InternetEgressBytes,
		InternetIngressBytes: metadata.NetworkMeter.Totals.InternetIngressBytes,
		HostEgressBytes:      metadata.NetworkMeter.Totals.HostEgressBytes,
		HostIngressBytes:     metadata.NetworkMeter.Totals.HostIngressBytes,
		TapEgressBytes:       metadata.NetworkMeter.Totals.TapEgressBytes,
		TapIngressBytes:      metadata.NetworkMeter.Totals.TapIngressBytes,
		SampledAt:            sampledAt,
		GenerationID:         metadata.GenerationID,
		State:                metadata.State.String(),
		RunningMillis:        runningMillis(metadata.RunningMeter),
		CPUVCPUs:             metadata.CPUQuota,
		MemoryGiB:            metadata.MemoryQuota,
		StorageGiB:           metadata.StorageQuota + metadata.AdditionalDiskQuota,
		GPUCount:             metadata.GPUQuota,
		TelemetryMeasurement: "unavailable",
	}
	if metadata.State == types.RuntimeStateStarted && metadata.VsockSocket != "" && metadata.ControlAuthToken != "" {
		client, clientErr := guestcontrol.NewClient(metadata.VsockSocket, metadata.ControlAuthToken)
		if clientErr == nil {
			defer client.Close()
			telemetry, telemetryErr := client.Telemetry(ctx)
			if telemetryErr == nil {
				sample.TelemetryMeasurement = "guest"
				sample.TelemetryBootID = telemetry.BootID
				sample.CPUTotalTicks = telemetry.CPUTotalTicks
				sample.CPUBusyTicks = telemetry.CPUBusyTicks
				sample.MemoryTotalBytes = telemetry.MemoryTotalBytes
				sample.MemoryUsedBytes = telemetry.MemoryUsedBytes
				sample.StorageTotalBytes = telemetry.StorageTotalBytes
				sample.StorageUsedBytes = telemetry.StorageUsedBytes
				sample.NetworkReceiveBytes = telemetry.NetworkReceiveBytes
				sample.NetworkTransmitBytes = telemetry.NetworkTransmitBytes
				sample.GPUUtilizationPercent = telemetry.GPUUtilizationPercent
				sample.GPUMemoryUsedBytes = telemetry.GPUMemoryUsedBytes
				sample.GPUMemoryTotalBytes = telemetry.GPUMemoryTotalBytes
			}
		}
	}
	return sample, nil
}

func (b *Backend) attachInstanceNetwork(ctx context.Context, metadata *state.InstanceMetadata) (bool, error) {
	if !instanceNetworkEnabled(*metadata) || instanceHasNetwork(*metadata) {
		return false, nil
	}
	policy, err := instanceEgressPolicy(*metadata)
	if err != nil {
		return false, mvmerrors.NewInvalidRequest(err)
	}
	allocation, err := b.networks.Allocate(ctx, metadata.ID)
	if err != nil {
		return false, fmt.Errorf("allocate instance network: %w", err)
	}
	if allocation == nil {
		return false, errors.New("instance requires networking but the machine network is disabled")
	}
	applyNetworkAllocation(metadata, allocation)
	if err := b.networks.ApplyEgressPolicy(ctx, instancePolicyBinding(*metadata, policy)); err != nil {
		releaseErr := b.networks.Release(context.WithoutCancel(ctx), allocation)
		clearNetworkIdentity(metadata)
		return false, errors.Join(fmt.Errorf("apply instance egress policy: %w", err), wrapOptionalError("release instance network", releaseErr))
	}
	return true, nil
}

func (b *Backend) observeNetworkMeter(ctx context.Context, metadata *state.InstanceMetadata) error {
	reading, err := b.networks.ReadMeter(ctx, metadata.Network)
	if err != nil {
		return fmt.Errorf("read instance network meter: %w", err)
	}
	if !reading.Available {
		return nil
	}
	if err := metadata.NetworkMeter.Observe(state.NetworkCounters{
		InternetEgressBytes:  reading.InternetEgressBytes,
		InternetIngressBytes: reading.InternetIngressBytes,
		HostEgressBytes:      reading.HostEgressBytes,
		HostIngressBytes:     reading.HostIngressBytes,
		TapEgressBytes:       reading.TapEgressBytes,
		TapIngressBytes:      reading.TapIngressBytes,
	}); err != nil {
		return fmt.Errorf("accumulate instance network meter: %w", err)
	}
	return nil
}

func (b *Backend) releaseMeteredNetwork(ctx context.Context, metadata *state.InstanceMetadata) error {
	meterErr := b.observeNetworkMeter(ctx, metadata)
	if meterErr != nil {
		slog.WarnContext(ctx, "could not take the final network meter sample before release", "instance_id", metadata.ID, "error", meterErr)
	}
	if err := b.releaseNetwork(ctx, *metadata); err != nil {
		return err
	}
	metadata.NetworkMeter.ReleaseDevice()
	return nil
}

// guestDialer reaches the instance's ports through its network namespace.
func (b *Backend) guestDialer(metadata state.InstanceMetadata) healthcheck.GuestDialer {
	allocation := metadata.Network
	if allocation == nil {
		return nil
	}
	return func(ctx context.Context, networkName string, port int) (net.Conn, error) {
		return b.networks.DialGuest(ctx, *allocation, networkName, port)
	}
}
