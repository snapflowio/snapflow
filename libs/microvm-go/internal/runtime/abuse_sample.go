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
	"net/netip"
	"os"
	"time"

	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/jail"
	"github.com/snapflowio/microvm-go/network"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) SetTrafficPolicy(ctx context.Context, policy network.TrafficPolicy) error {
	return b.networks.SetTrafficPolicy(ctx, policy)
}

func (b *Backend) SetPublicAddresses(ctx context.Context, addresses []netip.Addr) error {
	b.images.DenyRegistryAddresses(addresses)
	return b.networks.SetPublicAddresses(ctx, addresses)
}

func (b *Backend) AbuseSample(ctx context.Context, instanceID string) (types.AbuseSample, error) {
	guard, err := b.lifecycle.Lock(ctx, instanceID)
	if err != nil {
		return types.AbuseSample{}, fmt.Errorf("acquire instance lifecycle lock: %w", err)
	}
	defer guard.Release()
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return types.AbuseSample{}, mvmerrors.NewNotFound(fmt.Errorf("instance %s", instanceID))
		}
		return types.AbuseSample{}, err
	}
	sample := types.AbuseSample{SampledAt: time.Now().UTC(), VCPUs: metadata.CPUQuota}
	reading, err := b.networks.ReadGuard(ctx, metadata.Network)
	if err != nil {
		return types.AbuseSample{}, fmt.Errorf("read instance network guard: %w", err)
	}
	sample.Guard = reading
	meter, err := b.networks.ReadMeter(ctx, metadata.Network)
	if err != nil {
		return types.AbuseSample{}, fmt.Errorf("read instance network meter: %w", err)
	}
	sample.InternetEgressBytes = meter.InternetEgressBytes
	sample.InternetIngressBytes = meter.InternetIngressBytes
	sample.HostIngressBytes = meter.HostIngressBytes
	if metadata.State != types.RuntimeStateStarted || metadata.PID <= 0 || !b.processRunning(ctx, metadata) {
		return sample, nil
	}
	usage, err := jail.CPUUsageMicros(metadata.PID)
	if err != nil {
		return types.AbuseSample{}, fmt.Errorf("read instance CPU usage: %w", err)
	}
	sample.CPUUsageMicros = usage
	sample.Running = true
	return sample, nil
}
