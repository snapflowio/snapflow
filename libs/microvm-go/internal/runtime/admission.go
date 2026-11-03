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
	"net/http"
	"sync"

	"github.com/snapflowio/microvm-go/internal/admission"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/state"
)

func requestedResources(cpu, memory, disk, gpu int64) admission.Resources {
	return admission.Resources{
		CPUVCPUs:  cpu,
		MemoryGiB: memory,
		DiskGiB:   disk,
		GPUCount:  gpu,
	}
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
	})
}

func (b *Backend) reserveResources(ctx context.Context, id string, resources admission.Resources) (*resourceReservation, error) {
	reservation, err := b.admission.Reserve(ctx, id, resources)
	if err != nil {
		return nil, admissionError("reserve instance resources", err)
	}
	return &resourceReservation{backend: b, id: id, inner: reservation}, nil
}

func admissionError(operation string, err error) error {
	var insufficient *admission.InsufficientError
	if errors.As(err, &insufficient) {
		return mvmerrors.New(
			http.StatusServiceUnavailable,
			insufficient.Error(),
			"MICROVM_INSUFFICIENT_"+string(insufficient.Resource),
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
