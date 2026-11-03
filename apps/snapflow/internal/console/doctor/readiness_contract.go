// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package doctor

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/snapflowio/snapflow/internal/readiness"
	"github.com/snapflowio/snapflow/internal/release"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type diagnosticRuntime struct {
	capabilities sandboxruntime.Capabilities
}

func (diagnosticRuntime) Health(context.Context) []sandboxruntime.ServiceHealth {
	return []sandboxruntime.ServiceHealth{}
}

func (runtime diagnosticRuntime) Capabilities(context.Context) (sandboxruntime.Capabilities, error) {
	return runtime.capabilities, nil
}

type diagnosticMetrics struct{}

func (diagnosticMetrics) Collect(context.Context) (*readiness.HostMetrics, error) {
	return &readiness.HostMetrics{}, nil
}

func validateReadinessPayload(ctx context.Context, verified release.VerifiedRelease) error {
	payload, err := readiness.BuildPayload(ctx, readiness.PayloadConfig{
		State:     apiclient.MachineReadinessStateReady,
		Version:   verified.Manifest.Version,
		Runtime:   diagnosticRuntime{capabilities: releaseCapabilities(verified)},
		Collector: diagnosticMetrics{},
	})
	if err != nil {
		return err
	}
	if _, err := json.Marshal(payload); err != nil {
		return fmt.Errorf("serialize full machine readiness payload: %w", err)
	}
	return nil
}

func releaseCapabilities(verified release.VerifiedRelease) sandboxruntime.Capabilities {
	manifest := verified.Manifest
	return sandboxruntime.Capabilities{
		KVMAvailable:            true,
		Hypervisors:             []string{string(apiclient.MachineHypervisorFirecracker), string(apiclient.MachineHypervisorCloudHypervisor)},
		MachineReleaseVersion:   verified.Manifest.Version,
		MachineReleaseDigest:    verified.BundleDigest,
		ControlProtocolVersion:  verified.Manifest.Guest.ControlProtocolVersion,
		MachineIdentity:         manifest.FileIdentity(release.RoleSnapflowd),
		FirecrackerIdentity:     manifest.FileIdentity(release.RoleFirecracker),
		CloudHypervisorIdentity: manifest.FileIdentity(release.RoleCloudHypervisor),
		KernelIdentity:          manifest.FileIdentity(release.RoleKernel),
		InitrdIdentity:          manifest.FileIdentity(release.RoleInitrd),
		GuestPlatforms:          []string{verified.Manifest.OS + "/" + verified.Manifest.Architecture},
		PreparedImageDigests:    []string{},
		PreparedTemplateKeys:    []string{},
		PlatformArtifacts:       []sandboxruntime.PlatformArtifact{},
		Features:                []string{},
	}
}
