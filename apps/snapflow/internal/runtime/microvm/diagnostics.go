// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package microvm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/guestrelease"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

func (runtime *Runtime) RuntimeUsageSample(ctx context.Context, id string) (types.RuntimeUsageSample, error) {
	sample, err := runtime.engine.RuntimeUsageSample(ctx, id)
	if err != nil {
		return types.RuntimeUsageSample{}, err
	}
	if sample.State == types.RuntimeStateStandby.String() {
		sample.State = pausedRuntimeUsageState
	}
	return sample, nil
}

func (runtime *Runtime) DialRuntimePort(
	ctx context.Context,
	id string,
	target types.RuntimePortTarget,
) (net.Conn, error) {
	return runtime.engine.DialRuntimePort(ctx, id, target)
}

func (runtime *Runtime) Health(ctx context.Context) []sandboxruntime.ServiceHealth {
	health := sandboxruntime.ServiceHealth{Name: "microvm", Healthy: runtime.preflight.KVMAvailable}
	if !runtime.preflight.KVMAvailable {
		health.Error = errors.New("host KVM is unavailable")
		return []sandboxruntime.ServiceHealth{health}
	}
	if _, err := runtime.engine.AllocatedResources(ctx); err != nil {
		health.Healthy = false
		health.Error = fmt.Errorf("read microVM resource allocation: %w", err)
	}
	return []sandboxruntime.ServiceHealth{health}
}

func (runtime *Runtime) GuestServiceTarget(ctx context.Context, instanceID, serviceName string) (*types.ProxyTarget, error) {
	return runtime.engine.GuestServiceTarget(ctx, instanceID, serviceName)
}

func (runtime *Runtime) AllocatedResources(ctx context.Context) (types.AllocatedResources, error) {
	return runtime.engine.AllocatedResources(ctx)
}

func (runtime *Runtime) Capacity(ctx context.Context) (types.AllocatedResources, error) {
	return runtime.engine.Capacity(ctx)
}

func (runtime *Runtime) ImageCount(ctx context.Context) (int, error) {
	return runtime.engine.ImageCount(ctx)
}

func (runtime *Runtime) RuntimeInventory(ctx context.Context) ([]types.RuntimeObservation, error) {
	return runtime.engine.RuntimeInventory(ctx)
}

func (runtime *Runtime) Capabilities(ctx context.Context) (sandboxruntime.Capabilities, error) {
	preparedImageDigests, err := runtime.engine.PreparedImageDigests(ctx)
	if err != nil {
		return sandboxruntime.Capabilities{}, err
	}
	preparedTemplateKeys, err := runtime.engine.PreparedTemplateKeys(ctx)
	if err != nil {
		return sandboxruntime.Capabilities{}, err
	}
	return sandboxruntime.Capabilities{
		KVMAvailable:                 runtime.preflight.KVMAvailable,
		CgroupV2Available:            runtime.preflight.CgroupV2Available,
		FirecrackerSnapshotAvailable: runtime.preflight.FirecrackerSnapshotAvailable,
		FirecrackerTemplateAvailable: runtime.preflight.FirecrackerTemplateAvailable,
		Hypervisors:                  []string{string(apiclient.MachineHypervisorFirecracker), string(apiclient.MachineHypervisorCloudHypervisor)},
		FirecrackerVersion:           runtime.firecrackerVersion,
		CloudHypervisorVersion:       runtime.cloudHypervisorVersion,
		MachineReleaseVersion:        runtime.machineReleaseVersion,
		MachineReleaseDigest:         runtime.machineReleaseDigest,
		ControlProtocolVersion:       runtime.controlProtocolVersion,
		MachineIdentity:              runtime.machineIdentity,
		FirecrackerIdentity:          runtime.firecrackerIdentity,
		CloudHypervisorIdentity:      runtime.cloudHypervisorIdentity,
		KernelIdentity:               runtime.kernelIdentity,
		InitrdIdentity:               runtime.initrdIdentity,
		GuestPlatforms:               slices.Clone(runtime.guestPlatforms),
		PreparedImageDigests:         preparedImageDigests,
		PreparedTemplateKeys:         preparedTemplateKeys,
		GuestReleaseDigest:           runtime.guestReleaseDigest,
		PlatformArtifacts:            clonePlatformArtifacts(runtime.platformArtifacts),
		Features:                     runtimeFeatures(),
		BuilderImage:                 runtime.builderImage,
	}, nil
}

func runtimeFeatures() []string {
	return []string{
		string(apiclient.MachineRuntimeFeatureCheckpoint),
		string(apiclient.MachineRuntimeFeatureGuestService),
		string(apiclient.MachineRuntimeFeatureNetworkPolicy),
		string(apiclient.MachineRuntimeFeaturePause),
		string(apiclient.MachineRuntimeFeatureRuntimePort),
		string(apiclient.MachineRuntimeFeatureVolume),
	}
}

func (runtime *Runtime) toolboxVersion(ctx context.Context, instanceID string) (version string, resultErr error) {
	target, err := runtime.engine.GuestServiceTarget(ctx, instanceID, guestspec.ToolboxService)
	if err != nil {
		return "", err
	}
	readinessCtx, cancel := context.WithTimeout(ctx, runtime.toolboxReadinessTimeout)
	defer cancel()
	endpoint := target.URL.ResolveReference(&url.URL{Path: guestrelease.ToolboxVersionPath})
	request, err := http.NewRequestWithContext(readinessCtx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return "", fmt.Errorf("create toolbox version request: %w", err)
	}
	target.ApplyHeaders(request.Header)
	client := &http.Client{Transport: target.Transport}
	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer func() {
		if closeErr := response.Body.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close toolbox version response: %w", closeErr))
		}
	}()
	if target.ObserveResponse != nil {
		if err := target.ObserveResponse(readinessCtx, response.StatusCode); err != nil {
			return "", fmt.Errorf("record toolbox response: %w", err)
		}
	}
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("toolbox version returned HTTP %d", response.StatusCode)
	}
	var payload map[string]string
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("decode toolbox version response: %w", err)
	}
	version = strings.TrimSpace(payload[toolboxVersionKey])
	if version == "" {
		return "", errors.New("toolbox version response is missing version")
	}
	return version, nil
}

func clonePlatformArtifacts(source []sandboxruntime.PlatformArtifact) []sandboxruntime.PlatformArtifact {
	result := make([]sandboxruntime.PlatformArtifact, len(source))
	for index, artifact := range source {
		result[index] = artifact
		result[index].Capabilities = slices.Clone(artifact.Capabilities)
	}
	return result
}
