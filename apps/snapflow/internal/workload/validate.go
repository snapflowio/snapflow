// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package workload

import (
	"errors"
	"fmt"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/proto"
)

const (
	minimumQuota      = int32(1)
	minimumGPUQuota   = int32(0)
	minimumGeneration = uint32(1)
	minimumSizeGiB    = uint32(1)
	minimumSizeBytes  = int64(1)
)

func validate(message proto.Message) error {
	switch typed := message.(type) {
	case *machinev1alpha1.MachineDesiredState:
		return validateDesiredState(typed)
	case *machinev1alpha1.SandboxSecrets:
		return validateSecrets(typed)
	case *machinev1alpha1.SandboxObservedStatusReportResult:
		return validateReportResult(typed)
	case *machinev1alpha1.SnapshotSandboxPayload:
		return errors.Join(
			requiredField("name", typed.GetName()),
			validateRequiredRegistry("registry", typed.GetRegistry()),
			minimumField("assignmentGeneration", typed.GetAssignmentGeneration(), minimumGeneration),
		)
	case *machinev1alpha1.CreateBackupPayload:
		return validateCreateBackup(typed)
	case *machinev1alpha1.BackupVolumesPayload:
		return validateBackupVolumes(typed)
	case *machinev1alpha1.BuildSnapshotPayload:
		return validateBuildSnapshot(typed)
	case *machinev1alpha1.PublishSnapshotPayload:
		return errors.Join(
			requiredField("sourceRef", typed.GetSourceRef()),
			validateOptionalRegistry("sourceRegistry", typed.GetSourceRegistry()),
			requiredField("destinationRef", typed.GetDestinationRef()),
			validateRequiredRegistry("destinationRegistry", typed.GetDestinationRegistry()),
		)
	case *machinev1alpha1.SnapshotRegistryCredentials:
		return errors.Join(
			uuidField("registryId", typed.GetRegistryId()),
			validateRequiredRegistry("registry", typed.GetRegistry()),
		)
	case *machinev1alpha1.InspectSnapshotPayload:
		return errors.Join(
			requiredField("snapshot", typed.GetSnapshot()),
			validateOptionalRegistry("registry", typed.GetRegistry()),
		)
	case *machinev1alpha1.BenchmarkMachinePayload:
		return validateBenchmarkMachine(typed)
	case *machinev1alpha1.ResizeVolumePayload:
		return minimumField("targetSizeGiB", typed.GetTargetSizeGiB(), minimumSizeGiB)
	case *machinev1alpha1.RestoreVolumePayload:
		return errors.Join(
			requiredField("name", typed.GetName()),
			minimumField("sizeGiB", typed.GetSizeGiB(), minimumSizeGiB),
			oneOfField("filesystem", typed.GetFilesystem(), volumeFilesystems()),
			minimumField("backupGeneration", typed.GetBackupGeneration(), minimumGeneration),
			validateRequiredRestoreBackup("backup", typed.GetBackup()),
		)
	default:
		return fmt.Errorf("no validation rules for %s", message.ProtoReflect().Descriptor().FullName())
	}
}

func validateCreateBackup(payload *machinev1alpha1.CreateBackupPayload) error {
	errs := []error{
		validateRequiredRegistry("registry", payload.GetRegistry()),
		requiredField("snapshot", payload.GetSnapshot()),
		minimumField("assignmentGeneration", payload.GetAssignmentGeneration(), minimumGeneration),
		validateVolumeBackupRequests(payload.GetVolumeBackups()),
	}
	return errors.Join(errs...)
}

func validateBackupVolumes(payload *machinev1alpha1.BackupVolumesPayload) error {
	errs := []error{
		minimumField("assignmentGeneration", payload.GetAssignmentGeneration(), minimumGeneration),
		validateVolumeBackupRequests(payload.GetVolumeBackups()),
	}
	if len(payload.GetVolumeBackups()) == 0 {
		errs = append(errs, errors.New("volumeBackups must contain at least one volume"))
	}
	return errors.Join(errs...)
}

func validateVolumeBackupRequests(backups []*machinev1alpha1.VolumeBackupRequest) error {
	errs := make([]error, 0, len(backups))
	for index, backup := range backups {
		field := fmt.Sprintf("volumeBackups[%d]", index)
		errs = append(
			errs,
			uuidField(field+".volumeId", backup.GetVolumeId()),
			uuidField(field+".artifactId", backup.GetArtifactId()),
			urlField(field+".packUploadUrl", backup.GetPackUploadUrl()),
			urlField(field+".manifestUploadUrl", backup.GetManifestUploadUrl()),
			dataKeyField(field+".dataKey", backup.GetDataKey()),
			minimumField(field+".attachmentGeneration", backup.GetAttachmentGeneration(), minimumGeneration),
			uuidField(field+".fencingToken", backup.GetFencingToken()),
			minimumField(field+".backupGeneration", backup.GetBackupGeneration(), minimumGeneration),
		)
		if backup.Base != nil {
			errs = append(errs, validateBackupObject(field+".base", backup.GetBase()))
		}
	}
	return errors.Join(errs...)
}

func validateBuildSnapshot(payload *machinev1alpha1.BuildSnapshotPayload) error {
	errs := []error{
		requiredField("snapshot", payload.GetSnapshot()),
		requiredField("dockerfile", payload.GetDockerfile()),
		requiredField("ownerId", payload.GetOwnerId()),
		urlField("buildLogUploadUrl", payload.GetBuildLogUploadUrl()),
	}
	if payload.GetPushToInternalRegistry() {
		errs = append(errs, validateRequiredRegistry("registry", payload.GetRegistry()))
	} else {
		errs = append(errs, validateOptionalRegistry("registry", payload.GetRegistry()))
	}
	for index, buildContext := range payload.GetContexts() {
		field := fmt.Sprintf("contexts[%d]", index)
		errs = append(
			errs,
			requiredField(field+".hash", buildContext.GetHash()),
			urlField(field+".downloadUrl", buildContext.GetDownloadUrl()),
		)
	}
	for index, registry := range payload.GetSourceRegistries() {
		errs = append(errs, validateRequiredRegistry(fmt.Sprintf("sourceRegistries[%d]", index), registry))
	}
	return errors.Join(errs...)
}

func validateVolumes(volumes []*machinev1alpha1.VolumeAttachment) error {
	errs := make([]error, 0, len(volumes))
	for index, volume := range volumes {
		field := fmt.Sprintf("volumes[%d]", index)
		errs = append(
			errs,
			uuidField(field+".volumeId", volume.GetVolumeId()),
			requiredField(field+".name", volume.GetName()),
			minimumField(field+".sizeGiB", volume.GetSizeGiB(), minimumSizeGiB),
			oneOfField(field+".filesystem", volume.GetFilesystem(), volumeFilesystems()),
			requiredField(field+".mountPath", volume.GetMountPath()),
			minimumField(field+".generation", volume.GetGeneration(), minimumGeneration),
			uuidField(field+".fencingToken", volume.GetFencingToken()),
		)
		if volume.Restore != nil {
			errs = append(errs, validateRequiredRestoreBackup(field+".restore", volume.GetRestore()))
		}
	}
	return errors.Join(errs...)
}

func validateRequiredRestoreBackup(field string, backup *machinev1alpha1.RestoreVolumeBackup) error {
	if backup == nil {
		return fmt.Errorf("%s is required", field)
	}
	if backup.GetManifest() == nil {
		return fmt.Errorf("%s.manifest is required", field)
	}
	errs := []error{
		validateBackupObject(field+".manifest", backup.GetManifest()),
		minimumField(field+".expectedVolumeSizeBytes", backup.GetExpectedVolumeSizeBytes(), minimumSizeBytes),
	}
	seenPacks := make(map[string]struct{}, len(backup.GetPacks()))
	for index, pack := range backup.GetPacks() {
		packField := fmt.Sprintf("%s.packs[%d]", field, index)
		errs = append(errs, validateBackupObject(packField, pack))
		if _, exists := seenPacks[pack.GetArtifactId()]; exists {
			errs = append(errs, fmt.Errorf("%s.artifactId is duplicated", packField))
		}
		seenPacks[pack.GetArtifactId()] = struct{}{}
	}
	return errors.Join(errs...)
}

func validateBackupObject(field string, object *machinev1alpha1.VolumeBackupObject) error {
	return errors.Join(
		uuidField(field+".artifactId", object.GetArtifactId()),
		urlField(field+".downloadUrl", object.GetDownloadUrl()),
		dataKeyField(field+".dataKey", object.GetDataKey()),
	)
}

func validateOptionalTemplate(field string, template *machinev1alpha1.TemplatePreparation) error {
	if template == nil {
		return nil
	}
	return errors.Join(
		minimumField(field+".cpuQuota", template.GetCpuQuota(), minimumQuota),
		minimumField(field+".memoryQuota", template.GetMemoryQuota(), minimumQuota),
		minimumField(field+".storageQuota", template.GetStorageQuota(), minimumQuota),
		eachOneOfField(field+".capabilities", template.GetCapabilities(), guestCapabilities()),
	)
}

func validateRequiredRegistry(field string, registry *machinev1alpha1.Registry) error {
	if registry == nil {
		return fmt.Errorf("%s is required", field)
	}
	return requiredField(field+".url", registry.GetUrl())
}

func validateOptionalRegistry(field string, registry *machinev1alpha1.Registry) error {
	if registry == nil {
		return nil
	}
	return validateRequiredRegistry(field, registry)
}
