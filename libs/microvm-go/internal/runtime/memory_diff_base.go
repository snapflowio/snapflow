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
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/forkvm"
	"github.com/snapflowio/microvm-go/internal/state"
)

const diffBaseReflinkBudget = time.Second

var (
	errDiffBaseFragmented         = errors.New("the diff base is too fragmented to reflink within budget")
	errMemoryFileNotMapped        = errors.New("the VMM does not map a snapshot memory file")
	errMemoryFileMappingAmbiguous = errors.New("the VMM maps guest memory from more than one snapshot file")
	errMemoryFileChanged          = errors.New("the guest memory file no longer matches the recorded diff base")
	errMemoryFileSize             = errors.New("the guest memory file size does not match the guest memory")
	errMemoryFileUnrecorded       = errors.New("the diff base has no recorded memory file")
	errLoadedMemoryFileMismatch   = errors.New("the VMM maps a different file than the snapshot it restored")
	errDiffBaseUntracked          = errors.New("the VMM does not track dirty guest pages")
	errDiffBaseVMMChanged         = errors.New("the VMM is not the process the diff base was recorded for")
	errDiffBaseUnknown            = errors.New("the diff base of the VMM is unknown")
)

type dirtyPageTracker interface {
	TracksDirtyPages(ctx context.Context, socketPath string) (bool, error)
}

type memorySnapshotPlan struct {
	kind     hypervisor.SnapshotKind
	base     *state.MemoryDiffBase
	seedPath string
	fallback error
}

func fullMemorySnapshot(base *state.MemoryDiffBase, reason error) memorySnapshotPlan {
	return memorySnapshotPlan{kind: hypervisor.SnapshotFull, base: base, fallback: reason}
}

func (plan memorySnapshotPlan) diffSource() state.MemoryDiffBaseSource {
	if plan.kind != hypervisor.SnapshotDiff {
		return state.MemoryDiffBaseNone
	}
	return plan.base.Source
}

func (b *Backend) tracksDirtyPages(metadata state.InstanceMetadata) bool {
	return b.capabilities(metadata.Hypervisor).DiffSnapshotMemory != "" &&
		metadata.GPUQuota == 0 &&
		validateMemorySnapshotPolicy(metadata) == nil
}

func instanceMemoryBytes(metadata state.InstanceMetadata) int64 {
	return maxInt64(1, metadata.MemoryQuota) * bytesPerGiB
}

func (b *Backend) bootedMemoryDiffBase(metadata state.InstanceMetadata, process hypervisor.Process) *state.MemoryDiffBase {
	if !b.tracksDirtyPages(metadata) {
		return nil
	}
	return state.NewMemoryDiffBase(process, state.MemoryDiffBaseZero, nil)
}

func (b *Backend) restoredMemoryDiffBase(ctx context.Context, spec hypervisor.VM, process hypervisor.Process, snapshotDir string) *state.MemoryDiffBase {
	if !spec.TrackDirtyPages {
		return nil
	}
	memoryFile := b.capabilities(spec.Hypervisor).DiffSnapshotMemory
	identity, err := loadedFileIdentity(process.PID, memoryFile, filepath.Join(snapshotDir, memoryFile))
	if err != nil {
		slog.WarnContext(ctx, "could not identify the restored guest memory file; the next snapshot will be full", "instance_id", spec.ID, "error", err)
		return state.NewMemoryDiffBase(process, state.MemoryDiffBaseUnknown, nil)
	}
	return state.NewMemoryDiffBase(process, state.MemoryDiffBaseMapped, &identity)
}

func loadedFileIdentity(pid int, memoryFile, loadedPath string) (state.FileIdentity, error) {
	mappedPath, err := mappedMemoryFile(pid, memoryFile)
	if err != nil {
		return state.FileIdentity{}, err
	}
	mapped, err := fileIdentity(mappedPath)
	if err != nil {
		return state.FileIdentity{}, err
	}
	loaded, err := fileIdentity(loadedPath)
	if err != nil {
		return state.FileIdentity{}, err
	}
	if mapped != loaded {
		return state.FileIdentity{}, errLoadedMemoryFileMismatch
	}
	return mapped, nil
}

func (b *Backend) planMemorySnapshot(ctx context.Context, metadata state.InstanceMetadata, backend HypervisorBackend, base *state.MemoryDiffBase) memorySnapshotPlan {
	memoryFile := backend.Capabilities().DiffSnapshotMemory
	if memoryFile == "" || base == nil {
		return fullMemorySnapshot(base, errDiffBaseUntracked)
	}
	seedPath, err := b.diffBaseSeed(ctx, metadata, backend, memoryFile, base)
	if err != nil {
		return fullMemorySnapshot(base, err)
	}
	return memorySnapshotPlan{kind: hypervisor.SnapshotDiff, base: base, seedPath: seedPath}
}

func (b *Backend) diffBaseSeed(
	ctx context.Context,
	metadata state.InstanceMetadata,
	backend HypervisorBackend,
	memoryFile string,
	base *state.MemoryDiffBase,
) (string, error) {
	process := b.runningProcess(ctx, metadata)
	if !base.TracksVMM(process) {
		return "", errDiffBaseVMMChanged
	}
	if err := confirmDirtyPageTracking(ctx, backend, metadata.SocketPath); err != nil {
		return "", err
	}
	switch base.Source {
	case state.MemoryDiffBaseZero:
		return "", nil
	case state.MemoryDiffBaseMapped:
		path, err := mappedMemoryFile(process.PID, memoryFile)
		if err != nil {
			return "", err
		}
		return path, verifyMemoryFile(path, base.File, instanceMemoryBytes(metadata))
	case state.MemoryDiffBaseRetained:
		path := b.paths.InstanceMemoryBase(metadata.ID)
		return path, verifyMemoryFile(path, base.File, instanceMemoryBytes(metadata))
	default:
		return "", errDiffBaseUnknown
	}
}

func confirmDirtyPageTracking(ctx context.Context, backend HypervisorBackend, socketPath string) error {
	tracker, reports := backend.(dirtyPageTracker)
	if !reports {
		return errDiffBaseUntracked
	}
	tracked, err := tracker.TracksDirtyPages(ctx, socketPath)
	if err != nil {
		return fmt.Errorf("read the VMM dirty page tracking: %w", err)
	}
	if !tracked {
		return errDiffBaseUntracked
	}
	return nil
}

func verifyMemoryFile(path string, recorded *state.FileIdentity, guestMemoryBytes int64) error {
	if recorded == nil {
		return errMemoryFileUnrecorded
	}
	identity, err := fileIdentity(path)
	if err != nil {
		return err
	}
	if identity != *recorded {
		return errMemoryFileChanged
	}
	if identity.SizeBytes != guestMemoryBytes {
		return errMemoryFileSize
	}
	return nil
}

func seedMemorySnapshot(plan memorySnapshotPlan, memoryPath string) memorySnapshotPlan {
	if plan.kind != hypervisor.SnapshotDiff || plan.seedPath == "" {
		return plan
	}
	if err := forkvm.ReflinkFile(plan.seedPath, memoryPath, filemode.SharedFile); err != nil {
		return fullMemorySnapshot(plan.base, fmt.Errorf("reflink the diff base: %w", err))
	}
	return plan
}

func (b *Backend) retainMemorySnapshot(metadata *state.InstanceMetadata, plan memorySnapshotPlan, memoryPath string) (returnErr error) {
	if plan.base == nil {
		return nil
	}
	temporary := b.paths.InstanceMemoryBaseTemporary(metadata.ID)
	target := b.paths.InstanceMemoryBase(metadata.ID)
	if err := removeFileIfExists(temporary); err != nil {
		return fmt.Errorf("clear the previous diff base staging file: %w", err)
	}
	startedAt := time.Now()
	if err := forkvm.ReflinkFile(memoryPath, temporary, filemode.PrivateFile); err != nil {
		return fmt.Errorf("reflink the snapshot memory into the next diff base: %w", err)
	}
	defer func() {
		if returnErr != nil {
			returnErr = errors.Join(returnErr, wrapOptionalError("remove the unretained diff base", removeFileIfExists(temporary)))
		}
	}()
	if elapsed := time.Since(startedAt); elapsed > diffBaseReflinkBudget {
		return fmt.Errorf("%w: %s", errDiffBaseFragmented, elapsed)
	}
	if err := atomicfile.Commit(temporary); err != nil {
		return fmt.Errorf("commit the next diff base: %w", err)
	}
	if err := os.Rename(temporary, target); err != nil {
		return fmt.Errorf("install the next diff base: %w", err)
	}
	if err := atomicfile.Commit(target); err != nil {
		return fmt.Errorf("commit the installed diff base: %w", err)
	}
	identity, err := fileIdentity(target)
	if err != nil {
		return err
	}
	metadata.MemoryDiffBase = plan.base.Retained(identity)
	return nil
}

func (b *Backend) discardRetainedMemoryBase(instanceID string) error {
	return errors.Join(
		removeFileIfExists(b.paths.InstanceMemoryBaseTemporary(instanceID)),
		removeFileIfExists(b.paths.InstanceMemoryBase(instanceID)),
	)
}

func removeFileIfExists(path string) error {
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}
