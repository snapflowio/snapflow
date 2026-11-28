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
	"net/http"
	"sync"
	"time"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/admission"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/state"
)

const (
	releasedCapacityWait           = 30 * time.Second
	insufficientCapacityCodePrefix = "MICROVM_INSUFFICIENT_"
	bytesPerMiB                    = 1 << 20
	mebibytesPerGibibyte           = 1 << 10
	vmmMemoryOverheadMiB           = hypervisor.VMMMemoryOverheadBytes / bytesPerMiB
)

func requestedResources(cpu, memoryGiB, disk, gpu int64) admission.Resources {
	return admission.Resources{
		CPUVCPUs:  cpu,
		MemoryMiB: memoryFootprintMiB(memoryGiB),
		DiskGiB:   disk,
		GPUCount:  gpu,
	}
}

func memoryFootprintMiB(guestGiB int64) int64 {
	if guestGiB <= 0 {
		return 0
	}
	return guestGiB*mebibytesPerGibibyte + vmmMemoryOverheadMiB
}

func activeInstanceResources(metadata state.InstanceMetadata) admission.Resources {
	resources := requestedResources(
		metadata.CPUQuota,
		metadata.MemoryQuota,
		metadata.StorageQuota+metadata.AdditionalDiskQuota,
		metadata.GPUQuota,
	)
	if instanceNetworkEnabled(metadata) {
		resources.NetworkSlots = 1
	}
	return resources
}

func storedInstanceResources(metadata state.InstanceMetadata) admission.Resources {
	resources := requestedResources(0, 0, metadata.StorageQuota+metadata.AdditionalDiskQuota, 0)
	resources.NetworkSlots = instanceNetworkSlots(metadata)
	return resources
}

func instanceNetworkSlots(metadata state.InstanceMetadata) int64 {
	if instanceHasNetwork(metadata) {
		return 1
	}
	return 0
}

type resourceReservation struct {
	once    sync.Once
	backend *Backend
	id      string
	inner   *admission.Reservation
}

func (r *resourceReservation) Finish() {
	r.once.Do(func() {
		r.backend.refreshInstanceAllocation(r.id)
		r.inner.Finish()
		r.backend.logLedger("admission reservation released", r.id, admission.Resources{})
	})
}

func (b *Backend) logLedger(message, id string, requested admission.Resources) {
	claimed := b.admission.Claimed()
	capacity := b.admission.Capacity()
	slog.Debug(
		message,
		"instance_id", id,
		"requested_vcpus", requested.CPUVCPUs,
		"requested_memory_mib", requested.MemoryMiB,
		"allocated_vcpus", claimed.CPUVCPUs,
		"allocated_memory_mib", claimed.MemoryMiB,
		"capacity_vcpus", capacity.CPUVCPUs,
		"capacity_memory_mib", capacity.MemoryMiB,
	)
}

func (b *Backend) reserveResources(ctx context.Context, id string, resources admission.Resources) (*resourceReservation, error) {
	waitContext, cancel := context.WithTimeout(ctx, releasedCapacityWait)
	defer cancel()
	reservation, err := b.admission.Reserve(waitContext, id, resources)
	if err != nil {
		return nil, admissionError("reserve instance resources", err)
	}
	b.logLedger("admission reservation granted", id, resources)
	return &resourceReservation{backend: b, id: id, inner: reservation}, nil
}

func (b *Backend) reserveAvailableResources(ctx context.Context, id string, resources admission.Resources) (*resourceReservation, error) {
	reservation, err := b.admission.ReserveAvailable(ctx, id, resources)
	if err != nil {
		return nil, admissionError("reserve available instance resources", err)
	}
	b.logLedger("admission reservation granted", id, resources)
	return &resourceReservation{backend: b, id: id, inner: reservation}, nil
}

func admissionError(operation string, err error) error {
	var insufficient *admission.InsufficientError
	if errors.As(err, &insufficient) {
		return mvmerrors.NewWithCause(
			http.StatusServiceUnavailable,
			err.Error(),
			insufficientCapacityCodePrefix+string(insufficient.Resource),
			err,
		)
	}
	return fmt.Errorf("%s: %w", operation, err)
}

func (b *Backend) validateResourceShape(resources admission.Resources) error {
	if err := b.admission.ValidateShape(resources); err != nil {
		var insufficient *admission.InsufficientError
		if errors.As(err, &insufficient) {
			return mvmerrors.New(
				http.StatusUnprocessableEntity,
				insufficient.Error(),
				"MICROVM_RESOURCE_SHAPE_EXCEEDS_CAPACITY",
			)
		}
		return mvmerrors.NewInvalidRequest(fmt.Errorf("invalid instance resource shape: %w", err))
	}
	return nil
}
