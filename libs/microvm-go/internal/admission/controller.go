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

package admission

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

type Resource string

const (
	ResourceCPU     Resource = "cpu"
	ResourceMemory  Resource = "memory"
	ResourceDisk    Resource = "disk"
	ResourceGPU     Resource = "gpu"
	ResourceNetwork Resource = "network"
)

type Resources struct {
	CPUVCPUs     int64
	MemoryGiB    int64
	DiskGiB      int64
	GPUCount     int64
	NetworkSlots int64
}

func (r Resources) Validate() error {
	if r.CPUVCPUs < 0 || r.MemoryGiB < 0 || r.DiskGiB < 0 || r.GPUCount < 0 || r.NetworkSlots < 0 {
		return fmt.Errorf("resource values cannot be negative: %+v", r)
	}
	return nil
}

func (r Resources) add(other Resources) Resources {
	return Resources{
		CPUVCPUs:     r.CPUVCPUs + other.CPUVCPUs,
		MemoryGiB:    r.MemoryGiB + other.MemoryGiB,
		DiskGiB:      r.DiskGiB + other.DiskGiB,
		GPUCount:     r.GPUCount + other.GPUCount,
		NetworkSlots: r.NetworkSlots + other.NetworkSlots,
	}
}

func (r Resources) subtract(other Resources) Resources {
	return Resources{
		CPUVCPUs:     r.CPUVCPUs - other.CPUVCPUs,
		MemoryGiB:    r.MemoryGiB - other.MemoryGiB,
		DiskGiB:      r.DiskGiB - other.DiskGiB,
		GPUCount:     r.GPUCount - other.GPUCount,
		NetworkSlots: r.NetworkSlots - other.NetworkSlots,
	}
}

type Allocation struct {
	ID        string
	Resources Resources
}

type InsufficientError struct {
	Resource  Resource
	Requested int64
	Available int64
	Capacity  int64
	Allocated int64
}

func (e *InsufficientError) Error() string {
	return fmt.Sprintf(
		"insufficient %s capacity: requested %d, available %d (allocated %d of %d)",
		e.Resource,
		e.Requested,
		e.Available,
		e.Allocated,
		e.Capacity,
	)
}

type Controller struct {
	mu             sync.Mutex
	cpuGranularity int64
	capacity       Resources
	committed      map[string]Resources
	committedTotal Resources
	pending        map[string]Resources
	pendingTotal   Resources
}

func NewController(capacity Resources) (*Controller, error) {
	if err := capacity.Validate(); err != nil {
		return nil, fmt.Errorf("validate admission capacity: %w", err)
	}
	if capacity.CPUVCPUs == 0 || capacity.MemoryGiB == 0 || capacity.DiskGiB == 0 {
		return nil, errors.New("cpu, memory, and disk admission capacity must be positive")
	}
	return &Controller{
		capacity:  capacity,
		committed: make(map[string]Resources),
		pending:   make(map[string]Resources),
	}, nil
}

func (c *Controller) Replace(allocations []Allocation) {
	c.mu.Lock()
	committed := make(map[string]Resources, len(allocations))
	total := Resources{}
	for _, allocation := range allocations {
		resources := c.wholeCores(allocation.Resources)
		committed[allocation.ID] = committed[allocation.ID].add(resources)
		total = total.add(resources)
	}
	c.committed = committed
	c.committedTotal = total
	c.mu.Unlock()
}

func (c *Controller) Set(id string, resources Resources) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.setLocked(id, resources)
}

func (c *Controller) Admit(id string, target Resources) error {
	if id == "" {
		return errors.New("admission allocation id is required")
	}
	if err := target.Validate(); err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	target = c.wholeCores(target)
	used := c.committedTotal.subtract(c.committed[id]).add(c.pendingTotal)
	if err := validateAgainstCapacity(c.capacity, used, target); err != nil {
		return err
	}
	c.setLocked(id, target)
	return nil
}

func (c *Controller) setLocked(id string, resources Resources) {
	resources = c.wholeCores(resources)
	c.committedTotal = c.committedTotal.subtract(c.committed[id])
	if resources == (Resources{}) {
		delete(c.committed, id)
		return
	}
	c.committed[id] = resources
	c.committedTotal = c.committedTotal.add(resources)
}

func (c *Controller) Remove(id string) {
	c.Set(id, Resources{})
}

func (c *Controller) Committed() Resources {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.committedTotal
}

func (c *Controller) Allocation(id string) Resources {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.committed[id]
}

func (c *Controller) Capacity() Resources {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.capacity
}

func (c *Controller) Available() Resources {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.capacity.subtract(c.committedTotal).subtract(c.pendingTotal)
}

type Reservation struct {
	once       sync.Once
	controller *Controller
	id         string
}

func (r *Reservation) Finish() {
	if r == nil || r.controller == nil {
		return
	}
	r.once.Do(func() { r.controller.finish(r.id) })
}

func (c *Controller) ValidateShape(resources Resources) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	resources = c.wholeCores(resources)
	if err := resources.Validate(); err != nil {
		return err
	}
	return validateAgainstCapacity(c.capacity, Resources{}, resources)
}

func (c *Controller) UpdateCapacity(capacity Resources) error {
	if err := capacity.Validate(); err != nil {
		return fmt.Errorf("validate updated admission capacity: %w", err)
	}
	if capacity.CPUVCPUs == 0 || capacity.MemoryGiB == 0 || capacity.DiskGiB == 0 {
		return errors.New("cpu, memory, and disk admission capacity must be positive")
	}
	c.mu.Lock()
	c.capacity = capacity
	c.mu.Unlock()
	return nil
}

func (c *Controller) Reserve(ctx context.Context, id string, target Resources) (*Reservation, error) {
	if id == "" {
		return nil, errors.New("admission reservation id is required")
	}
	if err := target.Validate(); err != nil {
		return nil, err
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	target = c.wholeCores(target)
	used := c.committedTotal.subtract(c.committed[id]).add(c.pendingTotal.subtract(c.pending[id]))
	if err := validateAgainstCapacity(c.capacity, used, target); err != nil {
		return nil, err
	}
	c.pendingTotal = c.pendingTotal.subtract(c.pending[id]).add(target)
	c.pending[id] = target
	return &Reservation{controller: c, id: id}, nil
}

func (c *Controller) finish(id string) {
	c.mu.Lock()
	c.pendingTotal = c.pendingTotal.subtract(c.pending[id])
	delete(c.pending, id)
	c.mu.Unlock()
}

func validateAgainstCapacity(capacity, used, requested Resources) error {
	checks := []struct {
		resource  Resource
		capacity  int64
		allocated int64
		requested int64
	}{
		{ResourceCPU, capacity.CPUVCPUs, used.CPUVCPUs, requested.CPUVCPUs},
		{ResourceMemory, capacity.MemoryGiB, used.MemoryGiB, requested.MemoryGiB},
		{ResourceDisk, capacity.DiskGiB, used.DiskGiB, requested.DiskGiB},
		{ResourceGPU, capacity.GPUCount, used.GPUCount, requested.GPUCount},
		{ResourceNetwork, capacity.NetworkSlots, used.NetworkSlots, requested.NetworkSlots},
	}
	for _, check := range checks {
		available := check.capacity - check.allocated
		if check.requested > available {
			return &InsufficientError{
				Resource:  check.resource,
				Requested: check.requested,
				Available: max(0, available),
				Capacity:  check.capacity,
				Allocated: check.allocated,
			}
		}
	}
	return nil
}

// RoundCPUsTo counts every CPU amount in whole units of threads, the host's
// SMT threads per core, so anything admitted can be pinned to whole physical
// cores and no two workloads share a core's siblings.
func (c *Controller) RoundCPUsTo(threads int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cpuGranularity = threads
}

func (c *Controller) wholeCores(resources Resources) Resources {
	if granularity := c.cpuGranularity; granularity > 1 {
		resources.CPUVCPUs = (resources.CPUVCPUs + granularity - 1) / granularity * granularity
	}
	return resources
}
