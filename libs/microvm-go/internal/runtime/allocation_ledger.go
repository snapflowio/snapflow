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
	"os"
	"time"

	"github.com/snapflowio/microvm-go/cputopology"
	"github.com/snapflowio/microvm-go/internal/admission"
	"github.com/snapflowio/microvm-go/internal/diskusage"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

const (
	supportDiskAllocationID   = "__machine_support__"
	templateCacheAllocationID = "__template_cache__"
	volumeAllocationPrefix    = "__volume__:"
	supportDiskSampleEvery    = 30 * time.Second
)

func instanceAllocation(metadata state.InstanceMetadata) admission.Resources {
	if metadata.State == types.RuntimeStateDestroyed {
		return admission.Resources{}
	}
	resources := admission.Resources{}
	if !measuredAsSupportDisk(metadata) {
		resources.DiskGiB = metadata.StorageQuota + metadata.AdditionalDiskQuota
	}
	if stateConsumesCompute(metadata.State) {
		resources.CPUVCPUs = metadata.CPUQuota
		resources.MemoryGiB = metadata.MemoryQuota
		resources.GPUCount = metadata.GPUQuota
	}
	resources.NetworkSlots = instanceNetworkSlots(metadata)
	return resources
}

func (b *Backend) writeInstance(metadata state.InstanceMetadata) error {
	if err := state.WriteInstanceMetadata(b.paths, metadata); err != nil {
		return err
	}
	b.admission.Set(metadata.ID, instanceAllocation(metadata))
	return nil
}

func (b *Backend) refreshInstanceAllocation(id string) {
	metadata, err := state.ReadInstanceMetadata(b.paths, id)
	switch {
	case err == nil:
		b.admission.Set(id, instanceAllocation(metadata))
	case errors.Is(err, os.ErrNotExist):
		b.admission.Remove(id)
	default:
		slog.Warn("could not refresh instance resource allocation", "instance_id", id, "error", err)
	}
}

func (b *Backend) resynchronizeAllocations(ctx context.Context) error {
	allocations, err := b.admissionAllocations(ctx)
	if err != nil {
		return err
	}
	b.admission.Replace(allocations)
	return nil
}

func (b *Backend) sampleSupportDisk() error {
	listing, err := state.ListInstances(b.paths)
	if err != nil {
		return fmt.Errorf("list instances for machine support disk usage: %w", err)
	}
	allocations, err := b.supportDiskAllocations(listing.Instances)
	if err != nil {
		return err
	}
	for _, allocation := range allocations {
		b.admission.Set(allocation.ID, allocation.Resources)
	}
	return nil
}

func (b *Backend) supportDiskAllocations(instances []state.InstanceMetadata) ([]admission.Allocation, error) {
	breakdown, err := diskusage.Collect(b.paths, supportInstances(instances))
	if err != nil {
		return nil, fmt.Errorf("measure machine support disk usage: %w", err)
	}
	return []admission.Allocation{
		{ID: supportDiskAllocationID, Resources: admission.Resources{DiskGiB: bytesToGiBCeil(breakdown.FixedSupportBytes())}},
		{ID: templateCacheAllocationID, Resources: admission.Resources{DiskGiB: bytesToGiBCeil(breakdown.ReclaimableBytes())}},
	}, nil
}

func measuredAsSupportDisk(metadata state.InstanceMetadata) bool {
	return metadata.TemplateSeed || isInternalBuilder(metadata)
}

func (b *Backend) reclaimTemplateDisk(ctx context.Context, diskGiB int64) {
	for b.admission.Available().DiskGiB < diskGiB {
		evicted, err := b.templates.EvictLeastRecentlyUsed(ctx)
		if err != nil {
			slog.WarnContext(ctx, "could not evict a runtime template for disk capacity", "error", err)
		}
		if !evicted {
			return
		}
		if err := b.sampleSupportDisk(); err != nil {
			slog.WarnContext(ctx, "could not resample machine support disk usage", "error", err)
			return
		}
	}
}

func supportInstances(instances []state.InstanceMetadata) diskusage.SupportInstances {
	support := diskusage.SupportInstances{}
	for _, metadata := range instances {
		if metadata.State == types.RuntimeStateDestroyed {
			continue
		}
		switch {
		case metadata.TemplateSeed:
			support.TemplateSeeds = append(support.TemplateSeeds, metadata.ID)
		case isInternalBuilder(metadata):
			support.Builders = append(support.Builders, metadata.ID)
		}
	}
	return support
}

func (b *Backend) requestSupportDiskSample() {
	select {
	case b.supportDiskSamples <- struct{}{}:
	default:
	}
}

func (b *Backend) detectCapacity() (admission.Resources, error) {
	capacity, err := b.capacity()
	if err != nil {
		return admission.Resources{}, err
	}
	capacity.NetworkSlots = b.networks.Capacity()
	return capacity, nil
}

func (b *Backend) newAdmission() (*admission.Controller, error) {
	if b.capacity == nil {
		return nil, errors.New("microvm host capacity probe is required")
	}
	capacity, err := b.detectCapacity()
	if err != nil {
		return nil, err
	}
	controller, err := admission.NewController(capacity)
	if err != nil {
		return nil, fmt.Errorf("initialize resource admission: %w", err)
	}
	cores, err := cputopology.Cores()
	if err != nil {
		return nil, fmt.Errorf("read CPU topology for whole-core admission: %w", err)
	}
	controller.RoundCPUsTo(int64(cputopology.ThreadsPerCore(cores)))
	return controller, nil
}

func (b *Backend) refreshCapacity() error {
	capacity, err := b.detectCapacity()
	if err != nil {
		return err
	}
	return b.admission.UpdateCapacity(capacity)
}

func (b *Backend) superviseDiskUsage(ctx context.Context) {
	ticker := time.NewTicker(supportDiskSampleEvery)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		case <-b.supportDiskSamples:
		}
		if err := errors.Join(b.sampleSupportDisk(), b.refreshCapacity()); err != nil {
			slog.WarnContext(ctx, "could not sample machine disk usage", "error", err)
		}
	}
}
