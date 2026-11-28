// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package microvm

import (
	"context"
	"fmt"
	"math"

	"github.com/snapflowio/microvm-go/types"
	sandboxruntime "github.com/snapflowio/snapflow/internal/workloads/runtime"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

func (runtime *Runtime) CreateBackup(
	ctx context.Context,
	assignment sandboxruntime.Assignment,
	request *machinev1alpha1.CreateBackupPayload,
) (*machinev1alpha1.CreateBackupResult, error) {
	reference, err := registryImageReference(request.GetSnapshot(), request.GetRegistry())
	if err != nil {
		return nil, err
	}
	if err := runtime.Adopt(ctx, assignment); err != nil {
		return nil, err
	}
	exported, err := runtime.engine.ExportInstanceImage(ctx, assignment.SandboxID, types.ExportImageRequest{
		Source:    types.ExportImageSourceQuiesced,
		Reference: reference,
		Registry:  toMicroVMRegistry(request.GetRegistry()),
	})
	if err != nil {
		return nil, err
	}
	backups, err := runtime.backupInstanceVolumes(ctx, assignment.SandboxID, request.GetVolumeBackups())
	if err != nil {
		return nil, err
	}
	return &machinev1alpha1.CreateBackupResult{VolumeBackups: backups, BackupSizeBytes: exported.SizeBytes}, nil
}

func (runtime *Runtime) BackupVolumes(
	ctx context.Context,
	assignment sandboxruntime.Assignment,
	request *machinev1alpha1.BackupVolumesPayload,
) (*machinev1alpha1.BackupVolumesResult, error) {
	if err := runtime.Adopt(ctx, assignment); err != nil {
		return nil, err
	}
	backups, err := runtime.backupInstanceVolumes(ctx, assignment.SandboxID, request.GetVolumeBackups())
	if err != nil {
		return nil, err
	}
	return &machinev1alpha1.BackupVolumesResult{VolumeBackups: backups}, nil
}

func (runtime *Runtime) backupInstanceVolumes(
	ctx context.Context,
	instanceID string,
	requests []*machinev1alpha1.VolumeBackupRequest,
) ([]*machinev1alpha1.VolumeBackupResult, error) {
	if len(requests) == 0 {
		return nil, nil
	}
	items := make([]types.CreateInstanceVolumeBackupItem, len(requests))
	for index, volume := range requests {
		items[index] = types.CreateInstanceVolumeBackupItem{
			VolumeID: volume.GetVolumeId(), ArtifactID: volume.GetArtifactId(),
			PackUpload: toMicroVMObjectUpload(volume.GetPackUpload()), ManifestUploadURL: volume.GetManifestUploadUrl(),
			DataKey:              volume.GetDataKey(),
			AttachmentGeneration: uint64(volume.GetAttachmentGeneration()),
			FencingToken:         volume.GetFencingToken(),
			BackupGeneration:     uint64(volume.GetBackupGeneration()),
			Base:                 toMicroVMBackupObject(volume.GetBase()),
		}
	}
	backups, err := runtime.engine.CreateInstanceVolumeBackup(ctx, instanceID, types.CreateInstanceVolumeBackup{Items: items})
	if err != nil {
		return nil, err
	}
	results := make([]*machinev1alpha1.VolumeBackupResult, len(backups))
	for index, backup := range backups {
		backupGeneration, err := narrowGeneration(backup.BackupGeneration)
		if err != nil {
			return nil, fmt.Errorf("volume %s backup generation: %w", backup.VolumeID, err)
		}
		results[index] = &machinev1alpha1.VolumeBackupResult{
			VolumeId: backup.VolumeID, ArtifactId: backup.ArtifactID,
			BackupGeneration:      backupGeneration,
			PackSizeBytes:         backup.PackSizeBytes,
			ManifestSizeBytes:     backup.ManifestSizeBytes,
			ChangedBytes:          backup.ChangedBytes,
			ReferencedArtifactIds: backup.ReferencedArtifactIDs,
		}
	}
	return results, nil
}

func toMicroVMObjectUpload(upload *machinev1alpha1.ObjectStorageUpload) types.ObjectUpload {
	return types.ObjectUpload{
		Endpoint: upload.GetEndpoint(), Region: upload.GetRegion(), Bucket: upload.GetBucket(), Key: upload.GetKey(),
		ContentType: upload.GetContentType(), AccessKeyID: upload.GetAccessKeyId(),
		SecretAccessKey: upload.GetSecretAccessKey(), SessionToken: upload.GetSessionToken(),
		ExpiresAt: upload.GetExpiresAt().AsTime(),
	}
}

func toMicroVMBackupObject(object *machinev1alpha1.VolumeBackupObject) *types.VolumeBackupObject {
	if object == nil {
		return nil
	}
	value := backupObjectValue(object)
	return &value
}

func backupObjectValue(object *machinev1alpha1.VolumeBackupObject) types.VolumeBackupObject {
	return types.VolumeBackupObject{
		ArtifactID: object.GetArtifactId(), DownloadURL: object.GetDownloadUrl(), DataKey: object.GetDataKey(),
	}
}

func narrowGeneration(generation uint64) (uint32, error) {
	if generation > math.MaxUint32 {
		return 0, fmt.Errorf("generation %d exceeds the job contract range", generation)
	}
	return uint32(generation), nil
}
