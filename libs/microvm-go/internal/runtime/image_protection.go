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
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/snapflowio/microvm-go/internal/state"
)

func (b *Backend) protectedImageDirs() (map[string]bool, error) {
	instances, err := state.ListInstanceMetadata(b.paths)
	if err != nil {
		return nil, fmt.Errorf("list instance metadata: %w", err)
	}
	protected := make(map[string]bool)
	for _, instance := range instances {
		protectInstanceImages(protected, instance)
	}
	records, err := b.snapshots.ListRecords()
	if err != nil {
		return nil, fmt.Errorf("list snapshot records: %w", err)
	}
	for _, record := range records {
		var metadata state.InstanceMetadata
		if err := json.Unmarshal(record.StoredMetadata, &metadata); err != nil {
			return nil, fmt.Errorf("decode snapshot %s metadata: %w", record.Snapshot.ID, err)
		}
		protectInstanceImages(protected, metadata)
	}
	return protected, nil
}

func protectInstanceImages(protected map[string]bool, metadata state.InstanceMetadata) {
	if strings.TrimSpace(metadata.RootfsDisk) != "" {
		protected[filepath.Dir(metadata.RootfsDisk)] = true
	}
	for _, platformBundle := range metadata.PlatformBundles {
		if strings.TrimSpace(platformBundle.DiskPath) != "" {
			protected[filepath.Dir(platformBundle.DiskPath)] = true
		}
	}
}
