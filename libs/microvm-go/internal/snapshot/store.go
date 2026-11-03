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

package snapshot

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/forkvm"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/layout"
)

var ErrNotFound = errors.New("snapshot not found")

const (
	snapshotDirectoryPermissions = 0o700
	snapshotFilePermissions      = 0o600
)

type Store struct {
	paths layout.Paths
}

func NewStore(paths layout.Paths) Store {
	return Store{paths: paths}
}

func (s Store) CreateStoppedWithID(id string, source state.InstanceMetadata, name string) (Snapshot, error) {
	return s.createFromInstance(id, source, name, KindStopped, "")
}

func (s Store) CreateStandbyWithID(id string, source state.InstanceMetadata, name, vmSnapshotDir string) (Snapshot, error) {
	return s.createFromInstance(id, source, name, KindStandby, vmSnapshotDir)
}

func (s Store) createFromInstance(id string, source state.InstanceMetadata, name string, kind Kind, vmSnapshotDir string) (created Snapshot, returnErr error) {
	if _, err := uuid.Parse(id); err != nil {
		return Snapshot{}, fmt.Errorf("invalid snapshot id %q: %w", id, err)
	}
	payloadDir := s.paths.SnapshotPayloadDir(id)
	if err := createPrivateDirectory(payloadDir); err != nil {
		return Snapshot{}, fmt.Errorf("create snapshot payload directory: %w", err)
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		if cleanupErr := os.RemoveAll(s.paths.SnapshotDir(id)); cleanupErr != nil {
			returnErr = errors.Join(returnErr, fmt.Errorf("clean up partial snapshot: %w", cleanupErr))
		}
	}()
	if err := s.copySnapshotPayload(payloadDir, source, vmSnapshotDir); err != nil {
		return Snapshot{}, err
	}
	size, err := DirectorySize(payloadDir)
	if err != nil {
		return Snapshot{}, err
	}
	snapshot := Snapshot{
		ID:               id,
		Name:             name,
		Kind:             kind,
		SourceInstanceID: source.ID,
		SourceImage:      source.Image,
		SourceHypervisor: source.Hypervisor,
		CreatedAt:        time.Now().UTC(),
		SizeBytes:        size,
	}
	metadata, err := json.Marshal(source)
	if err != nil {
		return Snapshot{}, fmt.Errorf("marshal source metadata: %w", err)
	}
	if err := s.SaveRecord(Record{Snapshot: snapshot, StoredMetadata: metadata}); err != nil {
		return Snapshot{}, err
	}
	committed = true
	return snapshot, nil
}

func (s Store) copySnapshotPayload(payloadDir string, source state.InstanceMetadata, vmSnapshotDir string) error {
	files := []struct {
		source string
		name   string
	}{
		{source: source.OverlayDisk, name: "overlay.raw"},
		{source: source.ConfigDisk, name: "config.ext4"},
		{source: s.paths.InstanceMetadata(source.ID), name: "instance.metadata.json"},
	}
	for _, file := range files {
		if err := copySnapshotFile(file.source, filepath.Join(payloadDir, file.name)); err != nil {
			return err
		}
	}
	if vmSnapshotDir != "" {
		if err := forkvm.CopyDir(vmSnapshotDir, filepath.Join(payloadDir, vmPayloadDirectory)); err != nil {
			return fmt.Errorf("copy VM snapshot payload: %w", err)
		}
	}
	return secureSnapshotTree(payloadDir)
}

func copySnapshotFile(source, destination string) error {
	if source == "" {
		return nil
	}
	if _, err := os.Stat(source); err != nil {
		return fmt.Errorf("snapshot source %s: %w", source, err)
	}
	return forkvm.CopyFile(source, destination)
}

func (s Store) SaveRecord(record Record) error {
	if record.Snapshot.ID == "" {
		return errors.New("snapshot id is required")
	}
	if err := createPrivateDirectory(s.paths.SnapshotDir(record.Snapshot.ID)); err != nil {
		return fmt.Errorf("create snapshot directory: %w", err)
	}
	data, err := json.MarshalIndent(record, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal snapshot record: %w", err)
	}
	return atomicWriteFile(s.paths.SnapshotMetadata(record.Snapshot.ID), data, snapshotFilePermissions)
}

func (s Store) LoadRecord(id string) (Record, error) {
	data, err := os.ReadFile(s.paths.SnapshotMetadata(id))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Record{}, ErrNotFound
		}
		return Record{}, fmt.Errorf("read snapshot metadata: %w", err)
	}
	var record Record
	if err := json.Unmarshal(data, &record); err != nil {
		return Record{}, fmt.Errorf("decode snapshot metadata: %w", err)
	}
	if record.Snapshot.ID == "" {
		record.Snapshot.ID = id
	}
	return record, nil
}

func (s Store) ListRecords() ([]Record, error) {
	entries, err := os.ReadDir(s.paths.SnapshotsDir())
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, fmt.Errorf("read snapshot directory: %w", err)
	}
	records := make([]Record, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		record, err := s.LoadRecord(entry.Name())
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				continue
			}
			return nil, err
		}
		records = append(records, record)
	}
	return records, nil
}

func (s Store) Delete(id string) error {
	if _, err := s.LoadRecord(id); err != nil {
		return err
	}
	if err := os.RemoveAll(s.paths.SnapshotDir(id)); err != nil {
		return fmt.Errorf("delete snapshot: %w", err)
	}
	return nil
}

func DirectorySize(root string) (int64, error) {
	var total int64
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return fmt.Errorf("stat %s: %w", path, err)
		}
		if info.Mode().IsRegular() {
			total += info.Size()
		}
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("walk snapshot payload: %w", err)
	}
	return total, nil
}

func atomicWriteFile(target string, data []byte, perm fs.FileMode) error {
	if err := createPrivateDirectory(filepath.Dir(target)); err != nil {
		return fmt.Errorf("create metadata directory: %w", err)
	}
	if err := atomicfile.Replace(target, data, perm); err != nil {
		return fmt.Errorf("install snapshot metadata: %w", err)
	}
	if err := atomicfile.Commit(target); err != nil {
		return fmt.Errorf("commit snapshot metadata: %w", err)
	}
	return nil
}

func createPrivateDirectory(path string) error {
	if err := os.MkdirAll(path, snapshotDirectoryPermissions); err != nil {
		return err
	}
	return os.Chmod(path, snapshotDirectoryPermissions)
}

func secureSnapshotTree(root string) error {
	if err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		switch {
		case info.IsDir():
			return os.Chmod(path, snapshotDirectoryPermissions)
		case info.Mode().IsRegular():
			return os.Chmod(path, snapshotFilePermissions)
		case info.Mode()&os.ModeSymlink != 0:
			return nil
		default:
			return fmt.Errorf("unsupported snapshot artifact %s (%s)", path, info.Mode())
		}
	}); err != nil {
		return fmt.Errorf("secure snapshot payload: %w", err)
	}
	return nil
}
