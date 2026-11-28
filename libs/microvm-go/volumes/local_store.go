// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the license at http://www.apache.org/licenses/LICENSE-2.0
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
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/forkvm"
	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
	"github.com/snapflowio/microvm-go/layout"
)

const LocalBlockStoreKind = "local"

type LocalBlockStore struct {
	paths layout.Paths
}

func NewLocalBlockStore(paths layout.Paths) *LocalBlockStore {
	return &LocalBlockStore{paths: paths}
}

func (store *LocalBlockStore) Kind() string { return LocalBlockStoreKind }

func (store *LocalBlockStore) Ensure(ctx context.Context, request EnsureRequest) (returnErr error) {
	if err := ctx.Err(); err != nil {
		return err
	}
	diskPath := store.paths.VolumeData(request.ID)
	info, err := os.Stat(diskPath)
	if err == nil {
		expectedBytes := request.SizeGiB * gib
		if info.Size() != expectedBytes {
			return fmt.Errorf("local volume size is %d bytes, expected %d", info.Size(), expectedBytes)
		}
		return nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("inspect local volume: %w", err)
	}
	empty, err := os.MkdirTemp(store.paths.VolumeDir(request.ID), ".empty-*")
	if err != nil {
		return fmt.Errorf("create volume filesystem source: %w", err)
	}
	defer func() {
		if cleanupErr := os.RemoveAll(empty); cleanupErr != nil {
			returnErr = errors.Join(returnErr, fmt.Errorf("remove volume filesystem source: %w", cleanupErr))
		}
	}()
	if _, err := imagecache.CreateExt4Disk(ctx, empty, diskPath, request.SizeGiB*gib); err != nil {
		return fmt.Errorf("create volume filesystem: %w", err)
	}
	return preallocate(diskPath, request.SizeGiB*gib)
}

func (store *LocalBlockStore) Attach(ctx context.Context, volumeID string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	path := store.paths.VolumeData(volumeID)
	if _, err := os.Stat(path); err != nil {
		return "", fmt.Errorf("inspect local volume for attachment: %w", err)
	}
	return path, nil
}

func (store *LocalBlockStore) Detach(context.Context, string, string) error { return nil }

func (store *LocalBlockStore) Delete(ctx context.Context, volumeID string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := os.Remove(store.paths.VolumeData(volumeID)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("delete local volume data: %w", err)
	}
	return nil
}

func (store *LocalBlockStore) Snapshot(ctx context.Context, volumeID, destination string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := forkvm.CopyFile(store.paths.VolumeData(volumeID), destination); err != nil {
		return fmt.Errorf("snapshot local volume %s: %w", volumeID, err)
	}
	return nil
}

func (store *LocalBlockStore) Restore(ctx context.Context, volumeID, source string, expectedBytes int64) (returnErr error) {
	if err := ctx.Err(); err != nil {
		return err
	}
	info, err := os.Stat(source)
	if err != nil {
		return fmt.Errorf("stat restored local volume: %w", err)
	}
	if info.Size() != expectedBytes {
		return fmt.Errorf("restored local volume has size %d, expected %d", info.Size(), expectedBytes)
	}
	current := store.paths.VolumeData(volumeID)
	temporary := current + ".restore-" + uuid.NewString()
	if err := forkvm.CopyFile(source, temporary); err != nil {
		return fmt.Errorf("stage restored local volume: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			returnErr = errors.Join(returnErr, resourcecleanup.Remove(temporary, "staged restored local volume"))
		}
	}()
	file, err := os.OpenFile(temporary, os.O_RDWR, 0)
	if err != nil {
		return fmt.Errorf("open staged restored local volume: %w", err)
	}
	if err := file.Sync(); err != nil {
		return errors.Join(
			fmt.Errorf("sync staged restored local volume: %w", err),
			resourcecleanup.Close(file, "staged restored local volume"),
		)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close staged restored local volume: %w", err)
	}
	previous := current + ".previous-" + uuid.NewString()
	if err := os.Rename(current, previous); err != nil {
		return fmt.Errorf("preserve current local volume before restore: %w", err)
	}
	if err := os.Rename(temporary, current); err != nil {
		return errors.Join(
			fmt.Errorf("commit restored local volume: %w", err),
			func() error {
				if rollbackErr := os.Rename(previous, current); rollbackErr != nil {
					return fmt.Errorf("restore previous local volume: %w", rollbackErr)
				}
				return nil
			}(),
		)
	}
	committed = true
	return resourcecleanup.Remove(previous, "previous local volume after restore")
}

func (store *LocalBlockStore) Resize(ctx context.Context, volumeID string, targetBytes int64) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	path := store.paths.VolumeData(volumeID)
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("inspect local volume before resize: %w", err)
	}
	if targetBytes < info.Size() {
		return fmt.Errorf("local volume cannot shrink from %d to %d bytes", info.Size(), targetBytes)
	}
	if targetBytes > info.Size() {
		if err := os.Truncate(path, targetBytes); err != nil {
			return fmt.Errorf("grow local volume image: %w", err)
		}
		if err := preallocate(path, targetBytes); err != nil {
			return err
		}
	}
	return resizeExt4(ctx, path)
}
