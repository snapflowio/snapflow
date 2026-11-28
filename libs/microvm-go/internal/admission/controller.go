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
	"iter"
	"maps"
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
	MemoryMiB    int64
	DiskGiB      int64
	GPUCount     int64
	NetworkSlots int64
}

func (r Resources) Validate() error {
	if r.CPUVCPUs < 0 || r.MemoryMiB < 0 || r.DiskGiB < 0 || r.GPUCount < 0 || r.NetworkSlots < 0 {
		return fmt.Errorf("resource values cannot be negative: %+v", r)
	}
	return nil
}

func (r Resources) add(other Resources) Resources {
	return Resources{
		CPUVCPUs:     r.CPUVCPUs + other.CPUVCPUs,
		MemoryMiB:    r.MemoryMiB + other.MemoryMiB,
		DiskGiB:      r.DiskGiB + other.DiskGiB,
		GPUCount:     r.GPUCount + other.GPUCount,
		NetworkSlots: r.NetworkSlots + other.NetworkSlots,
	}
}

func (r Resources) subtract(other Resources) Resources {
	return Resources{
		CPUVCPUs:     r.CPUVCPUs - other.CPUVCPUs,
		MemoryMiB:    r.MemoryMiB - other.MemoryMiB,
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

func (r Resource) unit() string {
	switch r {
	case ResourceCPU:
		return "vCPU"
	case ResourceMemory:
		return "MiB"
	case ResourceDisk:
		return "GiB"
	case ResourceGPU:
		return "GPU"
	case ResourceNetwork:
		return "slot"
	default:
		return ""
	}
}

func (e *InsufficientError) Error() string {
	unit := e.Resource.unit()
	return fmt.Sprintf(
		"insufficient %s capacity: requested %d %s, available %d %s (allocated %d of %d %s)",
		e.Resource,
		e.Requested,
		unit,
		e.Available,
		unit,
		e.Allocated,
		e.Capacity,
		unit,
	)
}

func (r Resources) exceeds(other Resources) bool {
	return r.CPUVCPUs > other.CPUVCPUs ||
		r.MemoryMiB > other.MemoryMiB ||
		r.DiskGiB > other.DiskGiB ||
		r.GPUCount > other.GPUCount ||
		r.NetworkSlots > other.NetworkSlots
}

func (r Resources) covering(other Resources) Resources {
	return Resources{
		CPUVCPUs:     max(r.CPUVCPUs, other.CPUVCPUs),
		MemoryMiB:    max(r.MemoryMiB, other.MemoryMiB),
		DiskGiB:      max(r.DiskGiB, other.DiskGiB),
		GPUCount:     max(r.GPUCount, other.GPUCount),
		NetworkSlots: max(r.NetworkSlots, other.NetworkSlots),
	}
}

type Controller struct {
	mu             sync.Mutex
	cpuGranularity int64
	capacity       Resources
	committed      map[string]Resources
	committedTotal Resources
	pending        map[string]Resources
	owners         map[string]*Reservation
	claimedTotal   Resources
	releasing      map[string]struct{}
	preemptible    map[string]func()
	preempted      map[string]struct{}
	waiting        map[string]struct{}
	released       chan struct{}
}

func NewController(capacity Resources) (*Controller, error) {
	if err := capacity.Validate(); err != nil {
		return nil, fmt.Errorf("validate admission capacity: %w", err)
	}
	if capacity.CPUVCPUs == 0 || capacity.MemoryMiB == 0 || capacity.DiskGiB == 0 {
		return nil, errors.New("cpu, memory, and disk admission capacity must be positive")
	}
	return &Controller{
		capacity:    capacity,
		committed:   make(map[string]Resources),
		pending:     make(map[string]Resources),
		owners:      make(map[string]*Reservation),
		releasing:   make(map[string]struct{}),
		preemptible: make(map[string]func()),
		preempted:   make(map[string]struct{}),
		waiting:     make(map[string]struct{}),
		released:    make(chan struct{}),
	}, nil
}

func (c *Controller) Replace(allocations []Allocation) {
	c.mu.Lock()
	defer c.mu.Unlock()
	committed := make(map[string]Resources, len(allocations))
	total := Resources{}
	for _, allocation := range allocations {
		resources := c.wholeCores(allocation.Resources)
		committed[allocation.ID] = committed[allocation.ID].add(resources)
		total = total.add(resources)
	}
	c.committed = committed
	c.committedTotal = total
	c.claimedTotal = Resources{}
	for id := range c.committed {
		c.claimedTotal = c.claimedTotal.add(c.claimLocked(id))
	}
	for id, reserved := range c.pending {
		if _, found := c.committed[id]; !found {
			c.claimedTotal = c.claimedTotal.add(reserved)
		}
	}
	c.notifyReleasedLocked()
}

func (c *Controller) claimLocked(id string) Resources {
	return c.committed[id].covering(c.pending[id])
}

func (c *Controller) updateClaimLocked(id string, change func()) {
	before := c.claimLocked(id)
	change()
	after := c.claimLocked(id)
	c.claimedTotal = c.claimedTotal.subtract(before).add(after)
	if before.exceeds(after) {
		c.notifyReleasedLocked()
	}
}

func (c *Controller) Released() <-chan struct{} {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.released
}

func (c *Controller) BeginRelease(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.releasing[id] = struct{}{}
}

func (c *Controller) EndRelease(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, releasing := c.releasing[id]; !releasing {
		return
	}
	delete(c.releasing, id)
	c.notifyReleasedLocked()
}

func (c *Controller) BeginPreemptible(id string, preempt func()) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.preemptible[id] = preempt
}

func (c *Controller) EndPreemptible(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.preemptible, id)
	if _, preempted := c.preempted[id]; preempted {
		delete(c.preempted, id)
		c.notifyReleasedLocked()
	}
}

func (c *Controller) Idle() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.pending) == 0 && len(c.waiting) == 0
}

func (c *Controller) preemptLocked(excluded string) {
	for id, preempt := range c.preemptible {
		if id == excluded {
			continue
		}
		delete(c.preemptible, id)
		c.preempted[id] = struct{}{}
		preempt()
	}
}

func (c *Controller) notifyReleasedLocked() {
	close(c.released)
	c.released = make(chan struct{})
}

func (c *Controller) yieldingLocked(excluded string, sets ...iter.Seq[string]) Resources {
	counted := make(map[string]struct{})
	total := Resources{}
	for _, set := range sets {
		for id := range set {
			if _, seen := counted[id]; seen || id == excluded {
				continue
			}
			counted[id] = struct{}{}
			total = total.add(c.claimLocked(id))
		}
	}
	return total
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
	used := c.claimedTotal.subtract(c.claimLocked(id))
	if err := validateAgainstCapacity(c.capacity, used, target); err != nil {
		return err
	}
	c.setLocked(id, target)
	return nil
}

func (c *Controller) setLocked(id string, resources Resources) {
	resources = c.wholeCores(resources)
	c.updateClaimLocked(id, func() {
		c.committedTotal = c.committedTotal.subtract(c.committed[id])
		if resources == (Resources{}) {
			delete(c.committed, id)
			return
		}
		c.committed[id] = resources
		c.committedTotal = c.committedTotal.add(resources)
	})
}

func (c *Controller) Remove(id string) {
	c.Set(id, Resources{})
}

func (c *Controller) Committed() Resources {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.committedTotal
}

func (c *Controller) CommittedExcept(excluded func(id string) bool) Resources {
	c.mu.Lock()
	defer c.mu.Unlock()
	total := Resources{}
	for id, resources := range c.committed {
		if !excluded(id) {
			total = total.add(resources)
		}
	}
	return total
}

func (c *Controller) Claimed() Resources {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.claimedTotal
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
	return c.capacity.subtract(c.claimedTotal)
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
	r.once.Do(func() { r.controller.finish(r) })
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
	if capacity.CPUVCPUs == 0 || capacity.MemoryMiB == 0 || capacity.DiskGiB == 0 {
		return errors.New("cpu, memory, and disk admission capacity must be positive")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	grew := capacity.exceeds(c.capacity)
	c.capacity = capacity
	if grew {
		c.notifyReleasedLocked()
	}
	return nil
}

func (c *Controller) Fits(target Resources) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return validateAgainstCapacity(c.capacity, c.claimedTotal, c.wholeCores(target)) == nil
}

func (c *Controller) Reserve(ctx context.Context, id string, target Resources) (*Reservation, error) {
	return c.reserve(ctx, id, target, true)
}

func (c *Controller) ReserveAvailable(ctx context.Context, id string, target Resources) (*Reservation, error) {
	return c.reserve(ctx, id, target, false)
}

func (c *Controller) reserve(ctx context.Context, id string, target Resources, awaitRelease bool) (*Reservation, error) {
	if id == "" {
		return nil, errors.New("admission reservation id is required")
	}
	if err := target.Validate(); err != nil {
		return nil, err
	}
	defer c.stopWaiting(id)
	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		reservation, released, err := c.tryReserve(id, target, awaitRelease)
		if err == nil {
			return reservation, nil
		}
		if released == nil {
			return nil, err
		}
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("%w; capacity being released did not free in time: %w", err, context.Cause(ctx))
		case <-released:
		}
	}
}

func (c *Controller) stopWaiting(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.waiting, id)
}

func (c *Controller) tryReserve(id string, target Resources, awaitRelease bool) (*Reservation, <-chan struct{}, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.waiting, id)
	target = c.wholeCores(target)
	used := c.claimedTotal.subtract(c.claimLocked(id))
	err := validateAgainstCapacity(c.capacity, used, target)
	if err == nil {
		return c.grantLocked(id, target), nil, nil
	}
	if !awaitRelease {
		return nil, nil, err
	}
	if validateAgainstCapacity(c.capacity, used.subtract(c.yieldingLocked(id, maps.Keys(c.releasing))), target) == nil {
		c.waiting[id] = struct{}{}
		return nil, c.released, err
	}
	yielding := c.yieldingLocked(id, maps.Keys(c.releasing), maps.Keys(c.preempted), maps.Keys(c.preemptible))
	if validateAgainstCapacity(c.capacity, used.subtract(yielding), target) != nil {
		return nil, nil, err
	}
	c.preemptLocked(id)
	c.waiting[id] = struct{}{}
	return nil, c.released, err
}

func (c *Controller) grantLocked(id string, target Resources) *Reservation {
	reservation := &Reservation{controller: c, id: id}
	c.updateClaimLocked(id, func() {
		c.pending[id] = target
		c.owners[id] = reservation
	})
	return reservation
}

func (c *Controller) finish(reservation *Reservation) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.owners[reservation.id] != reservation {
		return
	}
	c.updateClaimLocked(reservation.id, func() {
		delete(c.pending, reservation.id)
		delete(c.owners, reservation.id)
	})
	c.notifyReleasedLocked()
}

func validateAgainstCapacity(capacity, used, requested Resources) error {
	checks := []struct {
		resource  Resource
		capacity  int64
		allocated int64
		requested int64
	}{
		{ResourceCPU, capacity.CPUVCPUs, used.CPUVCPUs, requested.CPUVCPUs},
		{ResourceMemory, capacity.MemoryMiB, used.MemoryMiB, requested.MemoryMiB},
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

func (c *Controller) CPUGranularity() int64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return max(1, c.cpuGranularity)
}

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
