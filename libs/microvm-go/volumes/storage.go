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

package volumes

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/layout"
)

func load(paths layout.Paths, id string) (Volume, error) {
	if err := validateVolumeID(id); err != nil {
		return Volume{}, err
	}
	data, err := os.ReadFile(paths.VolumeMetadata(id))
	if errors.Is(err, os.ErrNotExist) {
		return Volume{}, ErrNotFound
	}
	if err != nil {
		return Volume{}, fmt.Errorf("read volume metadata: %w", err)
	}
	var volume Volume
	if err := json.Unmarshal(data, &volume); err != nil {
		return Volume{}, fmt.Errorf("decode volume metadata: %w", err)
	}
	if volume.ID != id {
		return Volume{}, fmt.Errorf("volume metadata identity mismatch: expected %s, got %s", id, volume.ID)
	}
	if volume.SizeGiB <= 0 || volume.SizeGiB > maxVolumeSizeGiB {
		return Volume{}, fmt.Errorf("volume metadata size %d GiB is invalid", volume.SizeGiB)
	}
	return volume, nil
}

func save(paths layout.Paths, volume Volume) error {
	if err := validateVolumeID(volume.ID); err != nil {
		return err
	}
	if volume.SizeGiB <= 0 || volume.SizeGiB > maxVolumeSizeGiB {
		return fmt.Errorf("volume metadata size %d GiB is invalid", volume.SizeGiB)
	}
	data, err := json.MarshalIndent(volume, "", "  ")
	if err != nil {
		return fmt.Errorf("encode volume metadata: %w", err)
	}
	if err := atomicfile.Replace(paths.VolumeMetadata(volume.ID), data, filemode.PrivateFile); err != nil {
		return fmt.Errorf("persist volume metadata: %w", err)
	}
	if err := atomicfile.Commit(paths.VolumeMetadata(volume.ID)); err != nil {
		return fmt.Errorf("persist volume metadata: %w", err)
	}
	return nil
}

func listIDs(paths layout.Paths) ([]string, error) {
	entries, err := os.ReadDir(paths.VolumesDir())
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("list volume directory: %w", err)
	}
	ids := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if uuid.Validate(entry.Name()) != nil {
			continue
		}
		if _, err := os.Stat(filepath.Join(paths.VolumesDir(), entry.Name(), "metadata.json")); err == nil {
			ids = append(ids, entry.Name())
		}
	}
	return ids, nil
}

func validateVolumeID(id string) error {
	if err := uuid.Validate(id); err != nil {
		return fmt.Errorf("invalid volume id %q: %w", id, err)
	}
	return nil
}
