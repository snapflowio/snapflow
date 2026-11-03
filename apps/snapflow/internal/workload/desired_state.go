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

func validateDesiredState(document *machinev1alpha1.MachineDesiredState) error {
	errs := []error{
		requiredTimestamp("generatedAt", document.GetGeneratedAt().IsValid()),
		requiredTimestamp("expiresAt", document.GetExpiresAt().IsValid()),
		validateDocumentDigest(document),
		validateDesiredSnapshots(document.GetSnapshots()),
	}
	if !document.GetExpiresAt().AsTime().After(document.GetGeneratedAt().AsTime()) {
		errs = append(errs, errors.New("expiresAt must be after generatedAt"))
	}
	listed := make(map[string]bool, len(document.GetSandboxes()))
	for index, sandbox := range document.GetSandboxes() {
		field := fmt.Sprintf("sandboxes[%d]", index)
		if listed[sandbox.GetSandboxId()] {
			errs = append(errs, fmt.Errorf("%s lists sandbox %s twice", field, sandbox.GetSandboxId()))
		}
		listed[sandbox.GetSandboxId()] = true
		errs = append(errs, validateSandboxDesiredState(field, sandbox))
	}
	return errors.Join(errs...)
}

func validateDocumentDigest(document *machinev1alpha1.MachineDesiredState) error {
	unsigned, ok := proto.Clone(document).(*machinev1alpha1.MachineDesiredState)
	if !ok {
		return errors.New("clone desired-state document")
	}
	unsigned.Digest = ""
	return matchingDigest("digest", document.GetDigest(), unsigned)
}

func validateSandboxDesiredState(field string, sandbox *machinev1alpha1.SandboxDesiredState) error {
	errs := []error{
		uuidField(field+".sandboxId", sandbox.GetSandboxId()),
		minimumField(field+".assignmentGeneration", sandbox.GetAssignmentGeneration(), minimumGeneration),
		minimumField(field+".specGeneration", sandbox.GetSpecGeneration(), minimumGeneration),
		validateLifecycle(field+".lifecycle", sandbox.GetLifecycle()),
	}
	if sandbox.GetSpec() == nil {
		return errors.Join(append(errs, fmt.Errorf("%s.spec is required", field))...)
	}
	errs = append(
		errs,
		validateSpec(field+".spec", sandbox.GetSpec()),
		matchingDigest(field+".specDigest", sandbox.GetSpecDigest(), sandbox.GetSpec()),
	)
	return errors.Join(errs...)
}

func validateLifecycle(field string, lifecycle machinev1alpha1.SandboxLifecycle) error {
	switch lifecycle {
	case machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_STARTED,
		machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_STOPPED,
		machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_PAUSED,
		machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_DESTROYED:
		return nil
	default:
		return fmt.Errorf("%s %s is not a convergeable lifecycle", field, lifecycle)
	}
}

func validateSpec(field string, spec *machinev1alpha1.SandboxSpec) error {
	resources := spec.GetResources()
	if resources == nil {
		return fmt.Errorf("%s.resources is required", field)
	}
	return errors.Join(
		oneOfField(field+".mode", spec.GetMode(), sandboxModes()),
		eachOneOfField(field+".capabilities", spec.GetCapabilities(), sandboxCapabilities()),
		requiredField(field+".userId", spec.GetUserId()),
		requiredField(field+".osUser", spec.GetOsUser()),
		minimumField(field+".resources.cpuQuota", resources.GetCpuQuota(), minimumQuota),
		minimumField(field+".resources.gpuQuota", resources.GetGpuQuota(), minimumGPUQuota),
		minimumField(field+".resources.memoryQuota", resources.GetMemoryQuota(), minimumQuota),
		minimumField(field+".resources.storageQuota", resources.GetStorageQuota(), minimumQuota),
		validateVolumes(spec.GetVolumes()),
		optionalUUIDField(field+".linkedSandboxId", spec.LinkedSandboxId),
		validateSource(field, spec),
	)
}

func validateSource(field string, spec *machinev1alpha1.SandboxSpec) error {
	switch source := spec.GetSource().(type) {
	case *machinev1alpha1.SandboxSpec_Image:
		return requiredField(field+".image.ref", source.Image.GetRef())
	case *machinev1alpha1.SandboxSpec_Backup:
		return requiredField(field+".backup.ref", source.Backup.GetRef())
	case *machinev1alpha1.SandboxSpec_Fork:
		return uuidField(field+".fork.sourceSandboxId", source.Fork.GetSourceSandboxId())
	default:
		return fmt.Errorf("%s requires an image, backup or fork source", field)
	}
}

func validateSecrets(secrets *machinev1alpha1.SandboxSecrets) error {
	return errors.Join(
		uuidField("sandboxId", secrets.GetSandboxId()),
		minimumField("assignmentGeneration", secrets.GetAssignmentGeneration(), minimumGeneration),
		minimumField("specGeneration", secrets.GetSpecGeneration(), minimumGeneration),
	)
}

func validateReportResult(result *machinev1alpha1.SandboxObservedStatusReportResult) error {
	errs := make([]error, 0, len(result.GetAcknowledgements()))
	for index, acknowledgement := range result.GetAcknowledgements() {
		field := fmt.Sprintf("acknowledgements[%d]", index)
		errs = append(errs, requiredField(field+".sandboxId", acknowledgement.GetSandboxId()))
		if acknowledgement.GetVerdict() == machinev1alpha1.SandboxObservedStatusVerdict_SANDBOX_OBSERVED_STATUS_VERDICT_UNSPECIFIED {
			errs = append(errs, fmt.Errorf("%s.verdict is required", field))
		}
	}
	return errors.Join(errs...)
}

func requiredTimestamp(field string, valid bool) error {
	if !valid {
		return fmt.Errorf("%s is required", field)
	}
	return nil
}
