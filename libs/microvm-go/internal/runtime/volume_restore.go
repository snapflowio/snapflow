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
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/snapflowio/microvm-go/ext4"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/volumeartifact"
	"github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/microvm-go/volumes"
)

const fsckCorrectedExitCodes = 1 | 2

func (b *Backend) RestoreVolumeBackup(ctx context.Context, volumeID string, request types.RestoreVolumeBackup) error {
	_, err := runLifecycleOperation(b, request.InstanceID, volumeID, lifecycle.OperationRestoreVolume, func() (struct{}, error) {
		return struct{}{}, b.restoreVolumeBackupArtifact(ctx, volumeID, request, true)
	})
	return err
}

func (b *Backend) restoreVolumeBackupArtifact(ctx context.Context, volumeID string, request types.RestoreVolumeBackup, validateInstanceState bool) (returnErr error) {
	if validateInstanceState && request.InstanceID != "" && !request.VerifyOnly {
		guard, err := b.lifecycle.Lock(ctx, request.InstanceID)
		if err != nil {
			return fmt.Errorf("acquire instance lifecycle lock for volume restore: %w", err)
		}
		defer guard.Release()
		if err := b.verifyRestoreTarget(volumeID, request); err != nil {
			return err
		}
	}
	reservation, err := b.reserveResources(
		ctx,
		"volume-restore:"+request.Manifest.ArtifactID,
		requestedResources(0, 0, restoreScratchGiB(request), 0),
	)
	if err != nil {
		return fmt.Errorf("reserve volume restore scratch space: %w", err)
	}
	defer reservation.Finish()
	workDir := b.paths.SystemVolumeBackup(request.Manifest.ArtifactID)
	if err := os.RemoveAll(workDir); err != nil {
		return fmt.Errorf("clear volume restore workspace: %w", err)
	}
	if err := os.MkdirAll(workDir, filemode.PrivateDirectory); err != nil {
		return fmt.Errorf("create volume restore workspace: %w", err)
	}
	defer func() {
		if cleanupErr := os.RemoveAll(workDir); cleanupErr != nil {
			returnErr = errors.Join(returnErr, fmt.Errorf("remove volume restore workspace: %w", cleanupErr))
		}
	}()
	rawPath, err := b.recoverVolumeImage(ctx, volumeID, workDir, request)
	if err != nil || request.VerifyOnly {
		return err
	}
	return b.volumes.Restore(ctx, volumeID, volumes.RestoreRequest{
		Source: rawPath, InstanceID: request.InstanceID,
		Generation: request.Generation, FencingToken: request.FencingToken,
	})
}

func (b *Backend) verifyRestoreTarget(volumeID string, request types.RestoreVolumeBackup) error {
	metadata, err := state.ReadInstanceMetadata(b.paths, request.InstanceID)
	if err != nil {
		return fmt.Errorf("read attached instance for volume restore: %w", err)
	}
	if metadata.State != types.RuntimeStateStopped && metadata.State != types.RuntimeStateStandby {
		return stateConflict("instance must be stopped or in standby before restoring a volume", "MICROVM_VOLUME_RESTORE_STATE_CONFLICT")
	}
	if !metadataOwnsVolume(metadata, volumeID, request.FencingToken, request.Generation) {
		return errors.New("volume restore fence does not match instance metadata")
	}
	return nil
}

// restoreScratchGiB covers the sparse recovered image, which is read straight
// from the packs, plus the staged copy volumes.Restore installs from it.
func restoreScratchGiB(request types.RestoreVolumeBackup) int64 {
	scratchBytes := request.ExpectedVolumeSizeBytes
	if !request.VerifyOnly {
		scratchBytes += request.ExpectedVolumeSizeBytes
	}
	return bytesToGiBCeil(scratchBytes)
}

func (b *Backend) recoverVolumeImage(ctx context.Context, volumeID, workDir string, request types.RestoreVolumeBackup) (string, error) {
	packs := make([]volumeartifact.Object, 0, len(request.Packs))
	for _, pack := range request.Packs {
		packs = append(packs, backupObject(pack))
	}
	rawPath := filepath.Join(workDir, volumeImageFileName)
	if err := volumeartifact.NewRemote(b.transfers).RestoreBackup(ctx, volumeartifact.RestoreObjects{
		VolumeID:                volumeID,
		Manifest:                backupObject(request.Manifest),
		Packs:                   packs,
		ExpectedVolumeSizeBytes: request.ExpectedVolumeSizeBytes,
		DestinationPath:         rawPath,
	}); err != nil {
		return "", fmt.Errorf("recover volume backup %s: %w", request.Manifest.ArtifactID, err)
	}
	if err := validateRecoveredExt4(ctx, rawPath); err != nil {
		return "", fmt.Errorf("validate recovered volume filesystem: %w", err)
	}
	return rawPath, nil
}

func validateRecoveredExt4(ctx context.Context, imagePath string) error {
	fsck, err := ext4.FsckPath()
	if err != nil {
		return err
	}

	if output, runErr := exec.CommandContext(ctx, fsck, "-f", "-y", imagePath).CombinedOutput(); runErr != nil {
		var exitErr *exec.ExitError
		if !errors.As(runErr, &exitErr) || exitErr.ExitCode()&^fsckCorrectedExitCodes != 0 {
			return fsckError(runErr, output)
		}
	}
	if output, runErr := exec.CommandContext(ctx, fsck, "-f", "-n", imagePath).CombinedOutput(); runErr != nil {
		return fsckError(runErr, output)
	}
	return nil
}

func fsckError(err error, output []byte) error {
	detail := strings.TrimSpace(string(output))
	if detail == "" {
		return err
	}
	return fmt.Errorf("%w: %s", err, detail)
}
