// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package microvm

import (
	"context"
	"errors"
	"fmt"

	"github.com/snapflowio/microvm-go/types"
	microvmvolumes "github.com/snapflowio/microvm-go/volumes"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

func (runtime *Runtime) DeleteVolume(ctx context.Context, id string) error {
	err := runtime.engine.DeleteVolume(ctx, id)
	if errors.Is(err, microvmvolumes.ErrNotFound) {
		return nil
	}
	return err
}

func (runtime *Runtime) ResizeVolume(ctx context.Context, id string, request *machinev1alpha1.ResizeVolumePayload) error {
	if _, err := runtime.engine.ResizeVolume(ctx, id, int64(request.GetTargetSizeGiB())); err != nil {
		return err
	}
	return nil
}

func (runtime *Runtime) RestoreVolume(ctx context.Context, id string, request *machinev1alpha1.RestoreVolumePayload) error {
	if _, err := runtime.engine.EnsureVolume(ctx, microvmvolumes.EnsureRequest{
		ID: id, Name: request.GetName(), SizeGiB: int64(request.GetSizeGiB()), Filesystem: request.GetFilesystem(),
	}); err != nil {
		return fmt.Errorf("ensure restore destination: %w", err)
	}
	return runtime.engine.RestoreVolumeBackup(ctx, id, *toMicroVMRestoreBackup(request.GetBackup()))
}

func toMicroVMVolumes(values []*machinev1alpha1.VolumeAttachment) []types.VolumeAttachment {
	attachments := make([]types.VolumeAttachment, 0, len(values))
	for _, value := range values {
		attachments = append(attachments, types.VolumeAttachment{
			ID: value.GetVolumeId(), Name: value.GetName(), SizeGiB: int64(value.GetSizeGiB()),
			Filesystem: value.GetFilesystem(), MountPath: value.GetMountPath(), Subpath: value.GetSubpath(),
			ReadOnly: value.GetReadOnly(), Generation: uint64(value.GetGeneration()),
			FencingToken: value.GetFencingToken(), Restore: toMicroVMRestoreBackup(value.GetRestore()),
		})
	}
	return attachments
}

func toMicroVMRestoreBackup(backup *machinev1alpha1.RestoreVolumeBackup) *types.RestoreVolumeBackup {
	if backup == nil {
		return nil
	}
	packs := make([]types.VolumeBackupObject, 0, len(backup.GetPacks()))
	for _, pack := range backup.GetPacks() {
		packs = append(packs, backupObjectValue(pack))
	}
	return &types.RestoreVolumeBackup{
		Manifest: backupObjectValue(backup.GetManifest()), Packs: packs,
		ExpectedVolumeSizeBytes: backup.GetExpectedVolumeSizeBytes(),
	}
}
