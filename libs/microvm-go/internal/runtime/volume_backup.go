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
	"os"
	"path/filepath"

	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/volumeartifact"
	"github.com/snapflowio/microvm-go/types"
)

const bytesPerGiB = int64(1024 * 1024 * 1024)

const (
	volumeImageFileName = "volume.raw"
	volumePackFileName  = "pack"
)

type volumeBackupWork struct {
	volumeID             string
	artifactID           string
	packUploadURL        string
	manifestUploadURL    string
	dataKey              string
	base                 *types.VolumeBackupObject
	attachmentGeneration uint64
	fencingToken         string
	backupGeneration     uint64
	volumeSizeBytes      int64
	workDir              string
	rawPath              string
}

func (b *Backend) CreateInstanceVolumeBackup(ctx context.Context, instanceID string, request types.CreateInstanceVolumeBackup) ([]types.InstanceVolumeBackupResult, error) {
	return runLifecycleOperation(b, instanceID, "", lifecycle.OperationBackupVolume, func() (results []types.InstanceVolumeBackupResult, returnErr error) {
		work, err := b.prepareVolumeBackupWork(ctx, request.Items)
		if err != nil {
			return nil, err
		}
		defer func() {
			returnErr = errors.Join(returnErr, cleanupVolumeBackupWork(work))
		}()
		reservation, err := b.reserveResources(
			ctx,
			"volume-backup:"+instanceID,
			requestedResources(0, 0, backupScratchGiB(work), 0),
		)
		if err != nil {
			return nil, fmt.Errorf("reserve volume backup scratch space: %w", err)
		}
		defer reservation.Finish()
		if err := b.snapshotInstanceVolumeSet(ctx, instanceID, work); err != nil {
			return nil, err
		}

		remote := volumeartifact.NewRemote(b.transfers)
		results = make([]types.InstanceVolumeBackupResult, 0, len(work))
		for _, item := range work {
			published, err := remote.PublishBackup(ctx, item.publishRequest())
			if err != nil {
				return nil, fmt.Errorf("publish volume %s backup: %w", item.volumeID, err)
			}
			results = append(results, types.InstanceVolumeBackupResult{
				VolumeID:         item.volumeID,
				ArtifactID:       item.artifactID,
				BackupGeneration: item.backupGeneration,
				VolumeBackupResult: types.VolumeBackupResult{
					PackSizeBytes:         published.PackSizeBytes,
					ManifestSizeBytes:     published.ManifestSizeBytes,
					ChangedBytes:          published.ChangedBytes,
					ReferencedArtifactIDs: published.ReferencedArtifactIDs,
				},
			})
		}
		return results, nil
	})
}

func (item volumeBackupWork) publishRequest() volumeartifact.PublishRequest {
	request := volumeartifact.PublishRequest{
		VolumeID: item.volumeID, ArtifactID: item.artifactID, DataKey: item.dataKey,
		PackUploadURL: item.packUploadURL, ManifestUploadURL: item.manifestUploadURL,
		SourcePath: item.rawPath, PackPath: filepath.Join(item.workDir, volumePackFileName),
	}
	if item.base != nil {
		base := backupObject(*item.base)
		request.Base = &base
	}
	return request
}

func backupObject(object types.VolumeBackupObject) volumeartifact.Object {
	return volumeartifact.Object{ArtifactID: object.ArtifactID, URL: object.DownloadURL, DataKey: object.DataKey}
}

// backupScratchGiB covers the pack and manifest written per volume; the
// snapshot itself is a reflink clone that shares the volume's extents.
func backupScratchGiB(work []volumeBackupWork) int64 {
	var scratchBytes int64
	for _, item := range work {
		scratchBytes += volumeartifact.PackSizeLimit(item.volumeSizeBytes) + volumeartifact.ManifestSizeLimit(item.volumeSizeBytes)
	}
	return bytesToGiBCeil(scratchBytes)
}

func (b *Backend) prepareVolumeBackupWork(ctx context.Context, items []types.CreateInstanceVolumeBackupItem) ([]volumeBackupWork, error) {
	seenVolumes := make(map[string]struct{}, len(items))
	seenArtifacts := make(map[string]struct{}, len(items))
	work := make([]volumeBackupWork, 0, len(items))
	for _, item := range items {
		if _, exists := seenVolumes[item.VolumeID]; exists {
			return nil, errors.Join(
				fmt.Errorf("volume %s appears more than once in backup set", item.VolumeID),
				cleanupVolumeBackupWork(work),
			)
		}
		if _, exists := seenArtifacts[item.ArtifactID]; exists {
			return nil, errors.Join(
				fmt.Errorf("artifact %s appears more than once in backup set", item.ArtifactID),
				cleanupVolumeBackupWork(work),
			)
		}
		seenVolumes[item.VolumeID] = struct{}{}
		seenArtifacts[item.ArtifactID] = struct{}{}
		volume, err := b.volumes.Get(ctx, item.VolumeID)
		if err != nil {
			return nil, errors.Join(
				fmt.Errorf("read volume %s for backup: %w", item.VolumeID, err),
				cleanupVolumeBackupWork(work),
			)
		}
		workDir := b.paths.SystemVolumeBackup(item.ArtifactID)
		if err := os.RemoveAll(workDir); err != nil {
			return nil, errors.Join(
				fmt.Errorf("clear volume backup workspace: %w", err),
				cleanupVolumeBackupWork(work),
			)
		}
		if err := os.MkdirAll(workDir, filemode.PrivateDirectory); err != nil {
			return nil, errors.Join(
				fmt.Errorf("create volume backup workspace: %w", err),
				cleanupVolumeBackupWork(work),
			)
		}
		work = append(work, volumeBackupWork{
			volumeID: item.VolumeID, artifactID: item.ArtifactID,
			packUploadURL: item.PackUploadURL, manifestUploadURL: item.ManifestUploadURL,
			dataKey: item.DataKey, base: item.Base,
			attachmentGeneration: item.AttachmentGeneration,
			fencingToken:         item.FencingToken,
			backupGeneration:     item.BackupGeneration,
			volumeSizeBytes:      gibibytes(volume.SizeGiB),
			workDir:              workDir, rawPath: filepath.Join(workDir, volumeImageFileName),
		})
	}
	return work, nil
}

// snapshotInstanceVolumeSet takes a reflink clone of every volume. A running
// guest has its volume filesystems frozen around the clones so each clone is
// filesystem-consistent while the guest stalls only for the clone itself.
func (b *Backend) snapshotInstanceVolumeSet(ctx context.Context, instanceID string, work []volumeBackupWork) (returnErr error) {
	guard, err := b.lifecycle.Lock(ctx, instanceID)
	if err != nil {
		return fmt.Errorf("acquire instance lifecycle lock for volume backup: %w", err)
	}
	defer guard.Release()
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if err != nil {
		return fmt.Errorf("read attached instance for volume backup: %w", err)
	}
	running := metadata.State == types.RuntimeStateStarted
	if !running && !volumeBackupState(metadata.State) {
		return stateConflict("instance is changing state and cannot be backed up", "MICROVM_VOLUME_BACKUP_STATE_CONFLICT")
	}
	if err := b.verifyBackupFences(ctx, instanceID, metadata, work); err != nil {
		return err
	}
	if running {
		thaw, err := b.freezeGuestVolumes(ctx, metadata, work)
		if err != nil {
			return err
		}
		defer func() {
			returnErr = errors.Join(returnErr, wrapOptionalError("thaw guest volumes after backup snapshot", thaw()))
		}()
	}
	for _, item := range work {
		if err := b.volumes.Snapshot(ctx, item.volumeID, item.rawPath); err != nil {
			return fmt.Errorf("snapshot volume %s: %w", item.volumeID, err)
		}
	}
	return nil
}

func volumeBackupState(runtimeState types.RuntimeState) bool {
	switch runtimeState {
	case types.RuntimeStatePaused, types.RuntimeStateStopped, types.RuntimeStateStandby, types.RuntimeStateError:
		return true
	default:
		return false
	}
}

func (b *Backend) verifyBackupFences(ctx context.Context, instanceID string, metadata state.InstanceMetadata, work []volumeBackupWork) error {
	for _, item := range work {
		volume, err := b.volumes.Get(ctx, item.volumeID)
		if err != nil {
			return fmt.Errorf("read volume %s for backup: %w", item.volumeID, err)
		}
		if volume.Attachment == nil ||
			volume.Attachment.InstanceID != instanceID ||
			volume.Attachment.Generation != item.attachmentGeneration ||
			volume.Attachment.FencingToken != item.fencingToken ||
			!metadataOwnsVolume(metadata, item.volumeID, item.fencingToken, item.attachmentGeneration) {
			return fmt.Errorf("volume %s attachment fence does not match instance metadata", item.volumeID)
		}
	}
	return nil
}

func cleanupVolumeBackupWork(work []volumeBackupWork) error {
	var cleanupErrors []error
	for _, item := range work {
		if err := os.RemoveAll(item.workDir); err != nil {
			cleanupErrors = append(cleanupErrors, fmt.Errorf("remove volume backup workspace %s: %w", item.artifactID, err))
		}
	}
	return errors.Join(cleanupErrors...)
}
