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

package devices

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/filemode"
)

const (
	bootIDPath            = "/proc/sys/kernel/random/boot_id"
	quarantineEntrySuffix = ".json"
)

// GPUQuarantine holds GPUs that failed to come back clean from a tenant. A
// quarantined GPU is never assigned or listed again until the host reboots,
// which re-initializes the device; entries from an earlier boot lapse.
type GPUQuarantine struct {
	directory string
	bootID    func() (string, error)
	mu        sync.Mutex
}

// QuarantinedGPU is one GPU held back from tenants and why.
type QuarantinedGPU struct {
	PCIAddress    string    `json:"pciAddress"`
	BootID        string    `json:"bootId"`
	Reason        string    `json:"reason"`
	QuarantinedAt time.Time `json:"quarantinedAt"`
}

func NewGPUQuarantine(directory string) *GPUQuarantine {
	return &GPUQuarantine{directory: directory, bootID: currentBootID}
}

// Add quarantines the GPU at address for the rest of this boot.
func (q *GPUQuarantine) Add(address string, cause error) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	bootID, err := q.bootID()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(q.directory, filemode.PrivateDirectory); err != nil {
		return fmt.Errorf("create GPU quarantine directory: %w", err)
	}
	address = normalizePCIAddress(address)
	data, err := json.Marshal(QuarantinedGPU{
		PCIAddress: address, BootID: bootID, Reason: cause.Error(), QuarantinedAt: time.Now().UTC(),
	})
	if err != nil {
		return fmt.Errorf("encode GPU quarantine entry: %w", err)
	}
	path := filepath.Join(q.directory, address+quarantineEntrySuffix)
	if err := atomicfile.Replace(path, data, filemode.PrivateFile); err != nil {
		return fmt.Errorf("quarantine GPU %s: %w", address, err)
	}
	if err := atomicfile.Commit(path); err != nil {
		return fmt.Errorf("quarantine GPU %s: %w", address, err)
	}
	return nil
}

// List returns the GPUs quarantined during this boot, keyed by PCI address,
// and deletes entries left over from earlier boots.
func (q *GPUQuarantine) List() (map[string]QuarantinedGPU, error) {
	q.mu.Lock()
	defer q.mu.Unlock()
	entries, err := os.ReadDir(q.directory)
	if errors.Is(err, os.ErrNotExist) {
		return map[string]QuarantinedGPU{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read GPU quarantine: %w", err)
	}
	bootID, err := q.bootID()
	if err != nil {
		return nil, err
	}
	quarantined := make(map[string]QuarantinedGPU, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), quarantineEntrySuffix) {
			continue
		}
		path := filepath.Join(q.directory, entry.Name())
		gpu, err := readQuarantineEntry(path)
		if err != nil {
			return nil, err
		}
		if gpu.BootID != bootID {
			if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
				return nil, fmt.Errorf("clear lapsed GPU quarantine %s: %w", path, err)
			}
			continue
		}
		quarantined[gpu.PCIAddress] = gpu
	}
	return quarantined, nil
}

func readQuarantineEntry(path string) (QuarantinedGPU, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return QuarantinedGPU{}, fmt.Errorf("read GPU quarantine entry %s: %w", path, err)
	}
	var gpu QuarantinedGPU
	if err := json.Unmarshal(data, &gpu); err != nil {
		return QuarantinedGPU{}, fmt.Errorf("decode GPU quarantine entry %s: %w", path, err)
	}
	return gpu, nil
}

func currentBootID() (string, error) {
	data, err := os.ReadFile(bootIDPath)
	if err != nil {
		return "", fmt.Errorf("read boot id: %w", err)
	}
	return strings.TrimSpace(string(data)), nil
}
