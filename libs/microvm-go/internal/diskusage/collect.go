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

package diskusage

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/snapflowio/microvm-go/layout"
)

type Breakdown struct {
	Images            int64
	OCICache          int64
	InstanceOverlays  int64
	InstanceSnapshots int64
	Snapshots         int64
	TemplateSeeds     int64
	BuilderOverlays   int64
	BuilderState      int64
}

type SupportInstances struct {
	TemplateSeeds []string
	Builders      []string
}

func (b Breakdown) FixedSupportBytes() int64 {
	return b.Images + b.OCICache + b.InstanceSnapshots + b.Snapshots + b.BuilderOverlays + b.BuilderState
}

func (b Breakdown) ReclaimableBytes() int64 {
	return b.TemplateSeeds
}

func Collect(paths layout.Paths, support SupportInstances) (Breakdown, error) {
	images, err := sumMatchingFilesAllocatedBytes(paths.ImagesDir(), func(entry fs.DirEntry) bool {
		if entry.IsDir() {
			return false
		}
		return entry.Name() == layout.ImageDiskName
	})
	if err != nil {
		return Breakdown{}, fmt.Errorf("measure image disks: %w", err)
	}

	ociCache, err := sumTreeAllocatedBytes(paths.SystemOCICache())
	if err != nil {
		return Breakdown{}, fmt.Errorf("measure OCI cache: %w", err)
	}

	instanceOverlays, err := sumDirectChildAllocatedFileBytes(paths.InstancesDir(), "overlay.raw")
	if err != nil {
		return Breakdown{}, fmt.Errorf("measure instance overlays: %w", err)
	}
	instanceSnapshots, err := sumDirectChildTreeAllocatedBytes(paths.InstancesDir(), "snapshots")
	if err != nil {
		return Breakdown{}, fmt.Errorf("measure instance standby snapshots: %w", err)
	}

	snapshots, err := sumTreeAllocatedBytes(paths.SnapshotsDir())
	if err != nil {
		return Breakdown{}, fmt.Errorf("measure snapshots: %w", err)
	}

	builderState, err := sumTreeAllocatedBytes(paths.SystemBuildersDir())
	if err != nil {
		return Breakdown{}, fmt.Errorf("measure organization builder state: %w", err)
	}

	seedSnapshots := make(map[fileIdentity]struct{})
	var seedSnapshotBytes int64
	for _, seedID := range support.TemplateSeeds {
		allocated, err := sumTreeAllocatedBytesWithSeen(paths.InstanceSnapshotsDir(seedID), seedSnapshots)
		if err != nil {
			return Breakdown{}, fmt.Errorf("measure template seed snapshot: %w", err)
		}
		seedSnapshotBytes += allocated
	}

	return Breakdown{
		Images:            images,
		OCICache:          ociCache,
		InstanceOverlays:  instanceOverlays,
		InstanceSnapshots: max(0, instanceSnapshots-seedSnapshotBytes),
		Snapshots:         snapshots,
		TemplateSeeds:     seedSnapshotBytes + FilesAllocatedBytes(overlayPaths(paths, support.TemplateSeeds)),
		BuilderOverlays:   FilesAllocatedBytes(overlayPaths(paths, support.Builders)),
		BuilderState:      builderState,
	}, nil
}

func overlayPaths(paths layout.Paths, instanceIDs []string) []string {
	overlays := make([]string, len(instanceIDs))
	for index, instanceID := range instanceIDs {
		overlays[index] = paths.InstanceOverlay(instanceID)
	}
	return overlays
}

func FilesAllocatedBytes(files []string) int64 {
	seen := make(map[fileIdentity]struct{})
	var total int64
	for _, file := range files {
		total += allocatedBytesOnce(file, seen)
	}
	return total
}

func sumDirectChildTreeAllocatedBytes(root, childDir string) (int64, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	var total int64
	seen := make(map[fileIdentity]struct{})
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		allocated, err := sumTreeAllocatedBytesWithSeen(filepath.Join(root, entry.Name(), childDir), seen)
		if err != nil {
			return 0, err
		}
		total += allocated
	}
	return total, nil
}

func sumDirectChildAllocatedFileBytes(root, childFile string) (int64, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	var total int64
	seen := make(map[fileIdentity]struct{})
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		total += allocatedBytesOnce(filepath.Join(root, entry.Name(), childFile), seen)
	}
	return total, nil
}

func sumMatchingFilesAllocatedBytes(root string, match func(fs.DirEntry) bool) (int64, error) {
	var total int64
	seen := make(map[fileIdentity]struct{})
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		if match(entry) {
			total += allocatedBytesOnce(path, seen)
		}
		return nil
	})
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	return total, nil
}

func sumTreeAllocatedBytes(root string) (int64, error) {
	return sumTreeAllocatedBytesWithSeen(root, make(map[fileIdentity]struct{}))
}

func sumTreeAllocatedBytesWithSeen(root string, seen map[fileIdentity]struct{}) (int64, error) {
	var total int64
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		total += allocatedBytesOnce(path, seen)
		return nil
	})
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	return total, nil
}
