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

package microvm

import (
	"errors"
	"fmt"

	"github.com/snapflowio/microvm-go/devices"
)

const AllAdmittable int64 = 0

type Offer struct {
	CPUVCPUs  int64
	MemoryGiB int64
	DiskGiB   int64
}

func capacityProbe(detect func() (Capacity, error), gpus func() (int64, error), offer Offer) func() (Capacity, error) {
	return func() (Capacity, error) {
		admittable, err := detect()
		if err != nil {
			return Capacity{}, fmt.Errorf("detect host capacity: %w", err)
		}
		if admittable.GPUCount, err = gpus(); err != nil {
			return Capacity{}, fmt.Errorf("count listable GPUs: %w", err)
		}
		return offeredCapacity(admittable, offer)
	}
}

func offeredCapacity(admittable Capacity, offer Offer) (Capacity, error) {
	if offer.CPUVCPUs < AllAdmittable || offer.MemoryGiB < AllAdmittable || offer.DiskGiB < AllAdmittable {
		return Capacity{}, errors.New("offered capacity must not be negative")
	}
	admittable.CPUVCPUs = capped(admittable.CPUVCPUs, offer.CPUVCPUs)
	admittable.MemoryGiB = capped(admittable.MemoryGiB, offer.MemoryGiB)
	admittable.DiskGiB = capped(admittable.DiskGiB, offer.DiskGiB)
	return admittable, nil
}

func capped(admittable, offered int64) int64 {
	if offered == AllAdmittable {
		return admittable
	}
	return min(admittable, offered)
}

// listableGPUs is the host's passthrough GPUs less those quarantined after a
// failed release, which stay out of the listing until the host reboots.
func listableGPUs(passthrough int64, quarantine *devices.GPUQuarantine) func() (int64, error) {
	return func() (int64, error) {
		quarantined, err := quarantine.List()
		if err != nil {
			return 0, err
		}
		return max(0, passthrough-int64(len(quarantined))), nil
	}
}
