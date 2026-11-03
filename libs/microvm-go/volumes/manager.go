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
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
	"github.com/snapflowio/microvm-go/layout"
)

const (
	gib                 = int64(1024 * 1024 * 1024)
	maxVolumeSizeGiB    = (1<<63 - 1) / gib
	volumeDirectoryMode = 0o700
)

type Manager struct {
	paths   layout.Paths
	store   BlockStore
	locksMu sync.Mutex
	locks   map[string]*sync.RWMutex
}

type Option func(*Manager)

func WithBlockStore(store BlockStore) Option {
	return func(manager *Manager) { manager.store = store }
}

func NewManager(paths layout.Paths, options ...Option) *Manager {
	manager := &Manager{paths: paths, store: NewLocalBlockStore(paths), locks: make(map[string]*sync.RWMutex)}
	for _, option := range options {
		option(manager)
	}
	return manager
}

func (m *Manager) Ensure(ctx context.Context, request EnsureRequest) (result Volume, returnErr error) {
	if err := ctx.Err(); err != nil {
		return Volume{}, err
	}
	if err := normalizeEnsureRequest(&request); err != nil {
		return Volume{}, err
	}

	lock := m.lock(request.ID)
	lock.Lock()
	defer lock.Unlock()
	existing, err := load(m.paths, request.ID)
	if err == nil {
		if existing.Name != request.Name || existing.SizeGiB != request.SizeGiB || existing.Filesystem != request.Filesystem {
			return Volume{}, fmt.Errorf("%w: volume specification differs from existing volume", ErrAlreadyExists)
		}
		return existing, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return Volume{}, err
	}

	if err := os.MkdirAll(m.paths.VolumeDir(request.ID), volumeDirectoryMode); err != nil {
		return Volume{}, fmt.Errorf("create volume directory: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			returnErr = errors.Join(
				returnErr,
				resourcecleanup.RemoveAll(
					m.paths.VolumeDir(request.ID),
					"uncommitted volume directory",
				),
			)
		}
	}()
	volume, err := m.provision(ctx, request)
	if err != nil {
		return Volume{}, err
	}
	committed = true
	return volume, nil
}

func normalizeEnsureRequest(request *EnsureRequest) error {
	if err := validateVolumeID(request.ID); err != nil {
		return err
	}
	request.Name = strings.TrimSpace(request.Name)
	if request.Name == "" {
		return errors.New("volume name is required")
	}
	if request.SizeGiB <= 0 || request.SizeGiB > maxVolumeSizeGiB {
		return fmt.Errorf("volume size must be between 1 and %d GiB", maxVolumeSizeGiB)
	}
	if request.Filesystem == "" {
		request.Filesystem = FilesystemExt4
	}
	if request.Filesystem != FilesystemExt4 {
		return fmt.Errorf("unsupported volume filesystem %q", request.Filesystem)
	}
	return nil
}

func (m *Manager) provision(ctx context.Context, request EnsureRequest) (Volume, error) {
	if m.store == nil {
		return Volume{}, errors.New("volume block store is required")
	}
	if err := m.store.Ensure(ctx, request); err != nil {
		return Volume{}, fmt.Errorf("provision %s volume: %w", m.store.Kind(), err)
	}
	now := time.Now().UTC()
	volume := Volume{
		ID: request.ID, Name: request.Name, SizeGiB: request.SizeGiB,
		Filesystem: request.Filesystem, CreatedAt: now, UpdatedAt: now,
	}
	if err := save(m.paths, volume); err != nil {
		return Volume{}, err
	}
	return volume, nil
}

func (m *Manager) Attach(ctx context.Context, volumeID string, request AttachRequest) (MountedVolume, error) {
	if err := ctx.Err(); err != nil {
		return MountedVolume{}, err
	}
	if err := validateAttachRequest(request); err != nil {
		return MountedVolume{}, err
	}

	lock := m.lock(volumeID)
	lock.Lock()
	defer lock.Unlock()
	volume, err := load(m.paths, volumeID)
	if err != nil {
		return MountedVolume{}, err
	}
	if request.Generation < volume.Generation {
		return MountedVolume{}, fmt.Errorf("%w: generation %d is older than %d", ErrFenceRejected, request.Generation, volume.Generation)
	}
	if volume.Attachment != nil {
		return m.reattach(ctx, volume, request)
	}
	if request.Generation == volume.Generation && volume.Generation != 0 {
		return MountedVolume{}, fmt.Errorf("%w: generation %d requires the previously issued token", ErrFenceRejected, request.Generation)
	}
	attachment := &Attachment{
		InstanceID: request.InstanceID, MountPath: request.MountPath, Subpath: request.Subpath,
		ReadOnly: request.ReadOnly, Generation: request.Generation,
		FencingToken: request.FencingToken, AttachedAt: time.Now().UTC(),
	}
	diskPath, err := m.store.Attach(ctx, volumeID)
	if err != nil {
		return MountedVolume{}, fmt.Errorf("attach %s volume device: %w", m.store.Kind(), err)
	}
	volume.Generation = request.Generation
	volume.Attachment = attachment
	volume.UpdatedAt = time.Now().UTC()
	if err := save(m.paths, volume); err != nil {
		return MountedVolume{}, errors.Join(err, m.store.Detach(ctx, volumeID, diskPath))
	}
	return m.mounted(volume, *attachment, diskPath), nil
}

func validateAttachRequest(request AttachRequest) error {
	if strings.TrimSpace(request.InstanceID) == "" || strings.TrimSpace(request.FencingToken) == "" {
		return errors.New("instance id and fencing token are required")
	}
	if _, err := uuid.Parse(request.FencingToken); err != nil {
		return fmt.Errorf("invalid fencing token: %w", err)
	}
	if request.Generation == 0 {
		return errors.New("volume generation must be positive")
	}
	if err := validateMountPath(request.MountPath); err != nil {
		return err
	}
	return validateSubpath(request.Subpath)
}

func (m *Manager) reattach(ctx context.Context, volume Volume, request AttachRequest) (MountedVolume, error) {
	current := volume.Attachment
	if current.InstanceID != request.InstanceID || current.Generation != request.Generation || current.FencingToken != request.FencingToken {
		return MountedVolume{}, fmt.Errorf("%w: attached to instance %s", ErrInUse, current.InstanceID)
	}
	diskPath, err := m.store.Attach(ctx, volume.ID)
	if err != nil {
		return MountedVolume{}, err
	}
	return m.mounted(volume, *current, diskPath), nil
}

func (m *Manager) Detach(ctx context.Context, volumeID, instanceID, fencingToken string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	lock := m.lock(volumeID)
	lock.Lock()
	defer lock.Unlock()
	volume, err := load(m.paths, volumeID)
	if err != nil {
		return err
	}
	if volume.Attachment == nil {
		return nil
	}
	if volume.Attachment.InstanceID != instanceID || volume.Attachment.FencingToken != fencingToken {
		return fmt.Errorf("%w: attachment identity does not match", ErrFenceRejected)
	}
	diskPath, err := m.store.Attach(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("resolve %s volume device for detach: %w", m.store.Kind(), err)
	}
	if err := m.store.Detach(ctx, volumeID, diskPath); err != nil {
		return fmt.Errorf("detach %s volume device: %w", m.store.Kind(), err)
	}
	volume.Attachment = nil
	volume.UpdatedAt = time.Now().UTC()
	return save(m.paths, volume)
}

func (m *Manager) Delete(ctx context.Context, volumeID string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	lock := m.lock(volumeID)
	lock.Lock()
	defer lock.Unlock()
	volume, err := load(m.paths, volumeID)
	if err != nil {
		return err
	}
	if volume.Attachment != nil {
		return ErrInUse
	}
	if err := m.store.Delete(ctx, volumeID); err != nil {
		return fmt.Errorf("delete %s volume data: %w", m.store.Kind(), err)
	}
	if err := os.RemoveAll(m.paths.VolumeDir(volumeID)); err != nil {
		return fmt.Errorf("delete volume: %w", err)
	}
	return nil
}

func (m *Manager) Resize(ctx context.Context, volumeID string, targetSizeGiB int64) (Volume, error) {
	if err := ctx.Err(); err != nil {
		return Volume{}, err
	}
	if targetSizeGiB <= 0 || targetSizeGiB > maxVolumeSizeGiB {
		return Volume{}, fmt.Errorf("volume size must be between 1 and %d GiB", maxVolumeSizeGiB)
	}
	lock := m.lock(volumeID)
	lock.Lock()
	defer lock.Unlock()
	volume, err := load(m.paths, volumeID)
	if err != nil {
		return Volume{}, err
	}
	if volume.Attachment != nil {
		return Volume{}, ErrInUse
	}
	if targetSizeGiB < volume.SizeGiB {
		return Volume{}, fmt.Errorf("volume cannot shrink from %d to %d GiB", volume.SizeGiB, targetSizeGiB)
	}
	if targetSizeGiB == volume.SizeGiB {
		return volume, nil
	}
	if err := m.store.Resize(ctx, volumeID, targetSizeGiB*gib); err != nil {
		return Volume{}, fmt.Errorf("resize %s volume: %w", m.store.Kind(), err)
	}
	volume.SizeGiB = targetSizeGiB
	volume.UpdatedAt = time.Now().UTC()
	if err := save(m.paths, volume); err != nil {
		return Volume{}, fmt.Errorf("save resized volume metadata: %w", err)
	}
	return volume, nil
}

func (m *Manager) Snapshot(ctx context.Context, volumeID, destination string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	lock := m.lock(volumeID)
	lock.RLock()
	defer lock.RUnlock()
	if _, err := load(m.paths, volumeID); err != nil {
		return err
	}
	if err := m.store.Snapshot(ctx, volumeID, destination); err != nil {
		return fmt.Errorf("snapshot volume %s: %w", volumeID, err)
	}
	return nil
}

func (m *Manager) Restore(ctx context.Context, volumeID string, request RestoreRequest) (returnErr error) {
	if err := ctx.Err(); err != nil {
		return err
	}
	lock := m.lock(volumeID)
	lock.Lock()
	defer lock.Unlock()
	volume, err := load(m.paths, volumeID)
	if err != nil {
		return err
	}
	if volume.Attachment != nil &&
		(volume.Attachment.InstanceID != request.InstanceID ||
			volume.Attachment.Generation != request.Generation ||
			volume.Attachment.FencingToken != request.FencingToken) {
		return fmt.Errorf("%w: restore fence does not match the active attachment", ErrFenceRejected)
	}
	info, err := os.Stat(request.Source)
	if err != nil {
		return fmt.Errorf("stat restored volume: %w", err)
	}
	expectedSize := volume.SizeGiB * gib
	if info.Size() != expectedSize {
		return fmt.Errorf("restored volume has size %d, expected %d", info.Size(), expectedSize)
	}
	if err := m.store.Restore(ctx, volumeID, request.Source, expectedSize); err != nil {
		return fmt.Errorf("restore %s volume data: %w", m.store.Kind(), err)
	}
	volume.UpdatedAt = time.Now().UTC()
	if err := save(m.paths, volume); err != nil {
		return fmt.Errorf("save restored volume metadata: %w", err)
	}
	return nil
}

func (m *Manager) Get(ctx context.Context, volumeID string) (Volume, error) {
	if err := ctx.Err(); err != nil {
		return Volume{}, err
	}
	lock := m.lock(volumeID)
	lock.RLock()
	defer lock.RUnlock()
	return load(m.paths, volumeID)
}

func (m *Manager) List(ctx context.Context) ([]Volume, error) {
	ids, err := listIDs(m.paths)
	if err != nil {
		return nil, err
	}
	result := make([]Volume, 0, len(ids))
	for _, id := range ids {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		volume, err := m.Get(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("load volume %s: %w", id, err)
		}
		result = append(result, volume)
	}
	return result, nil
}

func (m *Manager) lock(id string) *sync.RWMutex {
	m.locksMu.Lock()
	defer m.locksMu.Unlock()
	lock, found := m.locks[id]
	if !found {
		lock = &sync.RWMutex{}
		m.locks[id] = lock
	}
	return lock
}

func (m *Manager) mounted(volume Volume, attachment Attachment, diskPath string) MountedVolume {
	return MountedVolume{
		VolumeID: volume.ID, DiskPath: diskPath,
		MountPath: attachment.MountPath, Subpath: attachment.Subpath, ReadOnly: attachment.ReadOnly,
		Generation: attachment.Generation, FencingToken: attachment.FencingToken,
	}
}

func validateMountPath(value string) error {
	for _, component := range strings.Split(filepath.ToSlash(value), "/") {
		if component == ".." {
			return errors.New("volume mount path cannot contain path traversal")
		}
	}
	clean := filepath.Clean(value)
	if !filepath.IsAbs(clean) || clean == string(filepath.Separator) {
		return errors.New("volume mount path must be an absolute non-root path")
	}
	return nil
}

func validateSubpath(value string) error {
	if value == "" {
		return nil
	}
	normalized := filepath.ToSlash(value)
	for _, component := range strings.Split(normalized, "/") {
		if component == ".." {
			return errors.New("volume subpath cannot contain path traversal")
		}
	}
	clean := filepath.Clean(value)
	if filepath.IsAbs(clean) || clean == "." {
		return errors.New("volume subpath must be a non-empty relative path")
	}
	return nil
}
