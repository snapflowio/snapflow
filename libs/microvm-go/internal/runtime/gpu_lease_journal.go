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
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/snapflowio/microvm-go/devices"
	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/state"
)

const gpuLeaseJournalExtension = ".json"

type gpuLeaseJournal struct {
	InstanceID  string              `json:"instanceId"`
	Assignments []devices.GPUDevice `json:"assignments"`
}

func (b *Backend) writeGPULeaseJournal(instanceID string, assignments []devices.GPUDevice) error {
	if err := state.ValidateInstanceID(instanceID); err != nil {
		return err
	}
	directory := b.paths.SystemGPULeasesDir()
	if err := os.MkdirAll(directory, filemode.PrivateDirectory); err != nil {
		return fmt.Errorf("create GPU lease journal directory: %w", err)
	}
	data, err := json.Marshal(gpuLeaseJournal{InstanceID: instanceID, Assignments: assignments})
	if err != nil {
		return fmt.Errorf("encode GPU lease journal: %w", err)
	}
	if err := atomicfile.Replace(b.paths.SystemGPULease(instanceID), data, filemode.PrivateFile); err != nil {
		return fmt.Errorf("commit GPU lease journal: %w", err)
	}
	if err := atomicfile.Commit(b.paths.SystemGPULease(instanceID)); err != nil {
		return fmt.Errorf("commit GPU lease journal: %w", err)
	}
	return nil
}

func (b *Backend) removeGPULeaseJournal(instanceID string) error {
	return removeFileDurably(b.paths.SystemGPULease(instanceID))
}

func removeFileDurably(path string) error {
	err := os.Remove(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	return atomicfile.Commit(filepath.Dir(path))
}

func (b *Backend) reconcileGPULeaseJournals(ctx context.Context) error {
	entries, err := os.ReadDir(b.paths.SystemGPULeasesDir())
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	active, err := b.activeGPULeases()
	if err != nil {
		return err
	}
	var result []error
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != gpuLeaseJournalExtension {
			continue
		}
		path := filepath.Join(b.paths.SystemGPULeasesDir(), entry.Name())
		if err := b.reconcileGPULeaseJournal(ctx, path, active); err != nil {
			result = append(result, err)
		}
	}
	return errors.Join(result...)
}

type activeGPULeases struct {
	instances map[string]struct{}
	devices   map[string]struct{}
}

func (b *Backend) activeGPULeases() (activeGPULeases, error) {
	active := activeGPULeases{instances: make(map[string]struct{}), devices: make(map[string]struct{})}
	listing, err := state.ListInstances(b.paths)
	if err != nil {
		return active, err
	}
	for instanceID := range listing.Unreadable {
		active.instances[instanceID] = struct{}{}
	}
	for _, metadata := range listing.Instances {
		if !reservesGPUDevices(metadata.State) || len(metadata.GPUAssignments) == 0 {
			continue
		}
		active.instances[metadata.ID] = struct{}{}
		for _, assignment := range metadata.GPUAssignments {
			markGPUAssignmentActive(active.devices, assignment)
		}
	}
	return active, nil
}

func (b *Backend) reconcileGPULeaseJournal(ctx context.Context, path string, active activeGPULeases) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var journal gpuLeaseJournal
	if err := json.Unmarshal(data, &journal); err != nil {
		return fmt.Errorf("decode GPU lease journal %s: %w", path, err)
	}
	if strings.TrimSpace(journal.InstanceID) == "" {
		return fmt.Errorf("gpu lease journal %s has no instance id", path)
	}
	if _, exists := active.instances[journal.InstanceID]; exists {
		return nil
	}
	restorable := restorableGPUAssignments(journal.Assignments, active.devices)
	if err := b.gpuDevices.Release(ctx, restorable); err != nil {
		return fmt.Errorf("restore orphaned GPU lease %s: %w", journal.InstanceID, err)
	}
	return removeFileDurably(path)
}

func markGPUAssignmentActive(active map[string]struct{}, assignment devices.GPUDevice) {
	if address := normalizeGPUAddress(assignment.PCIAddress); address != "" {
		active[address] = struct{}{}
	}
	for _, binding := range assignment.Bindings {
		if address := normalizeGPUAddress(binding.PCIAddress); address != "" {
			active[address] = struct{}{}
		}
	}
}

func restorableGPUAssignments(assignments []devices.GPUDevice, active map[string]struct{}) []devices.GPUDevice {
	result := make([]devices.GPUDevice, 0, len(assignments))
	for _, assignment := range assignments {
		if gpuAssignmentIsActive(assignment, active) {
			continue
		}
		result = append(result, assignment)
	}
	return result
}

func gpuAssignmentIsActive(assignment devices.GPUDevice, active map[string]struct{}) bool {
	if _, exists := active[normalizeGPUAddress(assignment.PCIAddress)]; exists {
		return true
	}
	for _, binding := range assignment.Bindings {
		if _, exists := active[normalizeGPUAddress(binding.PCIAddress)]; exists {
			return true
		}
	}
	return false
}

func normalizeGPUAddress(address string) string {
	return strings.ToLower(strings.TrimSpace(address))
}
