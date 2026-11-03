// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package readiness

import (
	"fmt"

	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type apiEnum interface {
	~string
	Valid() bool
}

func toAPICapabilities(value sandboxruntime.Capabilities) (apiclient.MachineRuntimeCapabilities, error) {
	hypervisors, err := toAPIEnums[apiclient.MachineHypervisor](value.Hypervisors, "machine hypervisor")
	if err != nil {
		return apiclient.MachineRuntimeCapabilities{}, err
	}
	features, err := toAPIEnums[apiclient.MachineRuntimeFeature](value.Features, "Snapflow runtime feature")
	if err != nil {
		return apiclient.MachineRuntimeCapabilities{}, err
	}
	platformArtifacts, err := toAPIPlatformArtifacts(value.PlatformArtifacts)
	if err != nil {
		return apiclient.MachineRuntimeCapabilities{}, err
	}
	return apiclient.MachineRuntimeCapabilities{
		KvmAvailable:                 value.KVMAvailable,
		CgroupV2Available:            value.CgroupV2Available,
		FirecrackerSnapshotAvailable: value.FirecrackerSnapshotAvailable,
		FirecrackerTemplateAvailable: value.FirecrackerTemplateAvailable,
		Hypervisors:                  hypervisors,
		MachineReleaseVersion:        value.MachineReleaseVersion,
		MachineReleaseDigest:         value.MachineReleaseDigest,
		ControlProtocolVersion:       int32(value.ControlProtocolVersion),
		MachineIdentity:              value.MachineIdentity,
		FirecrackerIdentity:          value.FirecrackerIdentity,
		CloudHypervisorIdentity:      value.CloudHypervisorIdentity,
		GuestPlatforms:               cloneRequiredSlice(value.GuestPlatforms),
		PreparedImageDigests:         cloneRequiredSlice(value.PreparedImageDigests),
		PreparedTemplateKeys:         cloneRequiredSlice(value.PreparedTemplateKeys),
		PlatformArtifacts:            platformArtifacts,
		Features:                     features,
		BuilderImage:                 value.BuilderImage,
		GuestReleaseDigest:           optional(value.GuestReleaseDigest),
		FirecrackerVersion:           optional(value.FirecrackerVersion),
		CloudHypervisorVersion:       optional(value.CloudHypervisorVersion),
		KernelIdentity:               optional(value.KernelIdentity),
		InitrdIdentity:               optional(value.InitrdIdentity),
	}, nil
}

func toAPIEnums[T apiEnum](values []string, description string) ([]T, error) {
	mapped := make([]T, 0, len(values))
	for _, candidate := range values {
		value := T(candidate)
		if !value.Valid() {
			return nil, fmt.Errorf("unsupported %s %q", description, candidate)
		}
		mapped = append(mapped, value)
	}
	return mapped, nil
}

func toAPIPlatformArtifacts(values []sandboxruntime.PlatformArtifact) ([]apiclient.MachinePlatformArtifact, error) {
	artifacts := make([]apiclient.MachinePlatformArtifact, 0, len(values))
	for _, artifact := range values {
		capabilities, err := toAPIEnums[apiclient.SandboxCapability](artifact.Capabilities, "sandbox capability")
		if err != nil {
			return nil, fmt.Errorf("platform artifact %s: %w", artifact.Name, err)
		}
		artifacts = append(artifacts, apiclient.MachinePlatformArtifact{
			Name:            artifact.Name,
			Digest:          artifact.Digest,
			Platform:        artifact.Platform,
			Capabilities:    capabilities,
			ProtocolVersion: float32(artifact.ProtocolVersion),
		})
	}
	return artifacts, nil
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func cloneRequiredSlice[T any](values []T) []T {
	result := make([]T, len(values))
	copy(result, values)
	return result
}
