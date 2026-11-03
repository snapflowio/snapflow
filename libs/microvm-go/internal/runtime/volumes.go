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

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/admission"
	"github.com/snapflowio/microvm-go/internal/configdrive"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/microvm-go/volumes"
)

const maxVolumesPerInstance = 16

func (b *Backend) prepareVolumeAttachments(ctx context.Context, metadata *state.InstanceMetadata, requested []types.VolumeAttachment) error {
	if len(requested) > maxVolumesPerInstance {
		return fmt.Errorf("a instance can attach at most %d persistent volumes", maxVolumesPerInstance)
	}
	seenVolumes := make(map[string]struct{}, len(requested))
	seenPaths := make(map[string]struct{}, len(requested))
	for _, request := range requested {
		if _, exists := seenVolumes[request.ID]; exists {
			return fmt.Errorf("volume %s is attached more than once", request.ID)
		}
		if _, exists := seenPaths[request.MountPath]; exists {
			return fmt.Errorf("volume mount path %s is duplicated", request.MountPath)
		}
		seenVolumes[request.ID] = struct{}{}
		seenPaths[request.MountPath] = struct{}{}

		ensured, err := b.ensureAdmittedVolume(ctx, volumes.EnsureRequest{
			ID: request.ID, Name: request.Name, SizeGiB: request.SizeGiB,
			Filesystem: request.Filesystem,
		})
		if err != nil {
			return fmt.Errorf("ensure volume %s: %w", request.ID, err)
		}
		mounted, err := b.volumes.Attach(ctx, ensured.ID, volumes.AttachRequest{
			InstanceID: metadata.ID, MountPath: request.MountPath, Subpath: request.Subpath,
			ReadOnly: request.ReadOnly, Generation: request.Generation,
			FencingToken: request.FencingToken,
		})
		if err != nil {
			return fmt.Errorf("attach volume %s: %w", request.ID, err)
		}
		metadata.VolumeAttachments = append(metadata.VolumeAttachments, mounted)
		if request.Restore != nil {
			restore := *request.Restore
			restore.InstanceID = metadata.ID
			restore.Generation = request.Generation
			restore.FencingToken = request.FencingToken
			if err := b.restoreVolumeBackupArtifact(ctx, request.ID, restore, false); err != nil {
				return fmt.Errorf("restore volume %s before instance boot: %w", request.ID, err)
			}
		}
		metadata.AdditionalDisks = append(metadata.AdditionalDisks, hypervisor.Disk{
			Path: mounted.DiskPath, Readonly: mounted.ReadOnly,
		})
	}
	return nil
}

func volumeMountConfiguration(metadata state.InstanceMetadata) ([]configdrive.VolumeMount, error) {
	mounts := make([]configdrive.VolumeMount, 0, len(metadata.VolumeAttachments))
	for index, volume := range metadata.VolumeAttachments {
		device, err := virtioBlockDevice(index + reservedVirtioDisks)
		if err != nil {
			return nil, err
		}
		mode := "rw"
		if volume.ReadOnly {
			mode = "ro"
		}
		mounts = append(mounts, configdrive.VolumeMount{
			Device: device, Path: volume.MountPath, Subpath: volume.Subpath, Mode: mode,
		})
	}
	return mounts, nil
}

const (
	reservedVirtioDisks = 3
	maxVirtioDisks      = 26
)

func virtioBlockDevice(index int) (string, error) {
	if index < 0 || index >= maxVirtioDisks {
		return "", fmt.Errorf("virtio disk index %d exceeds supported device range", index)
	}
	return fmt.Sprintf("/dev/vd%c", 'a'+rune(index)), nil
}

func (b *Backend) detachVolumeAttachments(ctx context.Context, metadata state.InstanceMetadata) error {
	var detachErrors []error
	for _, volume := range metadata.VolumeAttachments {
		if err := b.volumes.Detach(ctx, volume.VolumeID, metadata.ID, volume.FencingToken); err != nil && !errors.Is(err, volumes.ErrNotFound) {
			detachErrors = append(detachErrors, fmt.Errorf("detach volume %s: %w", volume.VolumeID, err))
		}
	}
	return errors.Join(detachErrors...)
}

func (b *Backend) reconcileVolumeAttachments(
	ctx context.Context,
	instances map[string]state.InstanceMetadata,
	quarantined map[string]struct{},
) error {
	localVolumes, err := b.volumes.List(ctx)
	if err != nil {
		return fmt.Errorf("list local volumes: %w", err)
	}
	localByID := make(map[string]volumes.Volume, len(localVolumes))
	var reconcileErrors []error
	for _, volume := range localVolumes {
		localByID[volume.ID] = volume
		if err := b.reconcileLocalVolume(ctx, volume, instances, quarantined); err != nil {
			reconcileErrors = append(reconcileErrors, err)
		}
	}
	for _, instance := range instances {
		reconcileErrors = append(reconcileErrors, instanceAttachmentErrors(instance, localByID)...)
	}
	return errors.Join(reconcileErrors...)
}

func (b *Backend) reconcileLocalVolume(
	ctx context.Context,
	volume volumes.Volume,
	instances map[string]state.InstanceMetadata,
	quarantined map[string]struct{},
) error {
	if volume.Attachment == nil {
		return nil
	}
	if _, held := quarantined[volume.Attachment.InstanceID]; held {
		return nil
	}
	instance, exists := instances[volume.Attachment.InstanceID]
	if !exists {
		if err := b.volumes.Detach(ctx, volume.ID, volume.Attachment.InstanceID, volume.Attachment.FencingToken); err != nil {
			return fmt.Errorf("detach orphaned volume %s: %w", volume.ID, err)
		}
		return nil
	}
	if !metadataOwnsVolume(instance, volume.ID, volume.Attachment.FencingToken, volume.Attachment.Generation) {
		return fmt.Errorf(
			"volume %s attachment does not match durable instance %s metadata",
			volume.ID,
			instance.ID,
		)
	}
	return nil
}

func instanceAttachmentErrors(instance state.InstanceMetadata, localByID map[string]volumes.Volume) []error {
	var attachmentErrors []error
	for _, attachment := range instance.VolumeAttachments {
		volume, exists := localByID[attachment.VolumeID]
		if !exists {
			attachmentErrors = append(attachmentErrors, fmt.Errorf("instance %s references missing volume %s", instance.ID, attachment.VolumeID))
			continue
		}
		if volume.Attachment == nil || volume.Attachment.InstanceID != instance.ID || volume.Attachment.FencingToken != attachment.FencingToken || volume.Attachment.Generation != attachment.Generation {
			attachmentErrors = append(attachmentErrors, fmt.Errorf("instance %s volume %s has an inconsistent attachment fence", instance.ID, attachment.VolumeID))
		}
	}
	return attachmentErrors
}

func metadataOwnsVolume(metadata state.InstanceMetadata, volumeID, fencingToken string, generation uint64) bool {
	for _, attachment := range metadata.VolumeAttachments {
		if attachment.VolumeID == volumeID && attachment.FencingToken == fencingToken && attachment.Generation == generation {
			return true
		}
	}
	return false
}

func (b *Backend) EnsureVolume(ctx context.Context, request volumes.EnsureRequest) (types.Volume, error) {
	volume, err := b.ensureAdmittedVolume(ctx, request)
	if err != nil {
		return types.Volume{}, err
	}
	return volumeDTO(volume), nil
}

// ensureAdmittedVolume reserves the volume's full logical size against disk
// capacity before creating it, so local volumes are never overcommitted.
func (b *Backend) ensureAdmittedVolume(ctx context.Context, request volumes.EnsureRequest) (volumes.Volume, error) {
	var volume volumes.Volume
	err := b.withVolumeAdmission(request.ID, request.SizeGiB, func() error {
		ensured, err := b.volumes.Ensure(ctx, request)
		volume = ensured
		return err
	})
	return volume, err
}

func (b *Backend) withVolumeAdmission(volumeID string, sizeGiB int64, apply func() error) error {
	id := volumeAllocationPrefix + volumeID
	previous := b.admission.Allocation(id)
	if err := b.admission.Admit(id, admission.Resources{DiskGiB: sizeGiB}); err != nil {
		return fmt.Errorf("admit volume %s: %w", volumeID, err)
	}
	if err := apply(); err != nil {
		b.restoreVolumeAllocation(id, previous)
		return err
	}
	return nil
}

func (b *Backend) restoreVolumeAllocation(id string, previous admission.Resources) {
	if previous == (admission.Resources{}) {
		b.admission.Remove(id)
		return
	}
	b.admission.Set(id, previous)
}

func (b *Backend) DeleteVolume(ctx context.Context, volumeID string) error {
	if err := b.volumes.Delete(ctx, volumeID); err != nil {
		return err
	}
	b.admission.Remove(volumeAllocationPrefix + volumeID)
	return nil
}

func (b *Backend) ResizeVolume(ctx context.Context, volumeID string, targetSizeGiB int64) (types.Volume, error) {
	var volume volumes.Volume
	err := b.withVolumeAdmission(volumeID, targetSizeGiB, func() error {
		resized, err := b.volumes.Resize(ctx, volumeID, targetSizeGiB)
		volume = resized
		return err
	})
	if err != nil {
		return types.Volume{}, err
	}
	return volumeDTO(volume), nil
}

func volumeDTO(volume volumes.Volume) types.Volume {
	result := types.Volume{
		ID: volume.ID, Name: volume.Name, SizeGiB: volume.SizeGiB,
		Filesystem: volume.Filesystem, Generation: volume.Generation,
	}
	if volume.Attachment != nil {
		result.Attachment = &types.VolumeAttachment{
			ID: volume.ID, Name: volume.Name, SizeGiB: volume.SizeGiB,
			Filesystem: volume.Filesystem, MountPath: volume.Attachment.MountPath, Subpath: volume.Attachment.Subpath,
			ReadOnly: volume.Attachment.ReadOnly, Generation: volume.Attachment.Generation,
			FencingToken: volume.Attachment.FencingToken,
		}
	}
	return result
}
