// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package microvm

import (
	"errors"
	"fmt"
	"maps"
	"slices"

	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/restartpolicy"
	"github.com/snapflowio/microvm-go/types"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

func toMicroVMCreateRequest(request sandboxruntime.MaterializeRequest) (types.CreateRequest, error) {
	if request.Assignment.Generation == 0 {
		return types.CreateRequest{}, errors.New("assignment generation must be positive")
	}
	spec := request.Spec
	mode := workload.SandboxMode(spec.GetMode())
	hypervisorName, profile, restartPolicy, err := modeRuntimePolicy(mode)
	if err != nil {
		return types.CreateRequest{}, err
	}
	resources := spec.GetResources()
	if mode == workload.SandboxModeEphemeral && resources.GetGpuQuota() > 0 {
		return types.CreateRequest{}, errors.New("ephemeral sandboxes cannot request GPUs")
	}
	guestValues, directIO := splitDirectIO(spec.GetCapabilities())
	capabilities, err := toMicroVMCapabilities(guestValues)
	if err != nil {
		return types.CreateRequest{}, err
	}
	image, entrypoint, err := sourceImage(spec)
	if err != nil {
		return types.CreateRequest{}, err
	}
	network := createNetworkPolicy(spec.GetNetwork())
	createRequest := types.CreateRequest{
		ID: request.Assignment.SandboxID, UserID: spec.GetUserId(), Image: image,
		Hypervisor: string(hypervisorName), OSUser: spec.GetOsUser(),
		CPUQuota: int64(resources.GetCpuQuota()), GPUQuota: int64(resources.GetGpuQuota()),
		MemoryQuota: int64(resources.GetMemoryQuota()), StorageQuota: int64(resources.GetStorageQuota()),
		Env: maps.Clone(spec.GetEnv()), SecretEnv: maps.Clone(request.Secrets.GetEnv()),
		Labels:          runtimeLabels(spec, profile),
		NetworkBlockAll: network.BlockAll, NetworkAllowList: network.AllowList,
		DomainAllowList: network.DomainAllowList, EgressBandwidthBPS: network.EgressBandwidthBps,
		NetworkName: spec.GetName(), Entrypoint: entrypoint,
		ImagePullPolicy: types.ImagePullNever,
		ManagedWorkload: true,
		RestartPolicy:   restartPolicy, Capabilities: capabilities, DirectIO: directIO,
		InitialState: initialMicroVMState(request.Start), Volumes: toMicroVMVolumes(spec.GetVolumes()),
		LinkedPeerID: spec.GetLinkedSandboxId(),
	}
	identityDigest, err := types.CreateRequestIntentDigest(createRequest)
	if err != nil {
		workload.ClearSecrets(createRequest.SecretEnv)
		return types.CreateRequest{}, err
	}
	createRequest.Identity = types.RuntimeArtifactIdentity{
		InstanceID: request.Assignment.SandboxID, AssignmentGeneration: int(request.Assignment.Generation),
		LifecycleGeneration: initialLifecycleGeneration, SpecificationGeneration: initialSpecificationGeneration,
		IntentDigest: identityDigest,
	}
	return createRequest, nil
}

func sourceImage(spec *machinev1alpha1.SandboxSpec) (string, []string, error) {
	switch source := spec.GetSource().(type) {
	case *machinev1alpha1.SandboxSpec_Image:
		return source.Image.GetRef(), slices.Clone(source.Image.GetEntrypoint()), nil
	case *machinev1alpha1.SandboxSpec_Backup:
		return source.Backup.GetRef(), nil, nil
	default:
		return "", nil, fmt.Errorf("sandbox source %T is not an image", source)
	}
}

func runtimeLabels(spec *machinev1alpha1.SandboxSpec, profile hypervisor.InstanceProfile) map[string]string {
	labels := maps.Clone(spec.GetLabels())
	if labels == nil {
		labels = make(map[string]string)
	}
	labels[profileLabel] = string(profile)
	if spec.GetName() != "" {
		labels[sandboxNameLabel] = spec.GetName()
	}
	return labels
}

func createNetworkPolicy(policy *machinev1alpha1.NetworkPolicy) *machinev1alpha1.NetworkPolicy {
	if policy == nil {
		return &machinev1alpha1.NetworkPolicy{}
	}
	return policy
}

func toMicroVMNetworkSettings(policy *machinev1alpha1.NetworkPolicy) types.NetworkSettings {
	blockAll := policy.GetBlockAll()
	allowList := policy.GetAllowList()
	domainAllowList := policy.GetDomainAllowList()
	egressBandwidthBPS := policy.GetEgressBandwidthBps()
	return types.NetworkSettings{
		NetworkBlockAll: &blockAll, NetworkAllowList: &allowList,
		DomainAllowList: &domainAllowList, EgressBandwidthBPS: &egressBandwidthBPS,
	}
}

func initialMicroVMState(start bool) types.InitialState {
	if start {
		return types.InitialStateRunning
	}
	return types.InitialStateStopped
}

func modeRuntimePolicy(mode workload.SandboxMode) (hypervisor.Hypervisor, hypervisor.InstanceProfile, *restartpolicy.Policy, error) {
	switch mode {
	case workload.SandboxModeEphemeral:
		return hypervisor.HypervisorFirecracker, hypervisor.InstanceProfileEphemeral, nil, nil
	case workload.SandboxModeStandard:
		return hypervisor.HypervisorCloudHypervisor, hypervisor.InstanceProfileService,
			&restartpolicy.Policy{Mode: restartpolicy.ModeOnFailure}, nil
	default:
		return "", "", nil, fmt.Errorf("unsupported sandbox mode %q", mode)
	}
}

func splitDirectIO(values []string) ([]string, bool) {
	guestValues := slices.DeleteFunc(slices.Clone(values), func(value string) bool {
		return value == string(workload.SandboxCapabilityDirectIO)
	})
	return guestValues, len(guestValues) != len(values)
}

func toMicroVMCapabilities(values []string) ([]guest.SandboxCapability, error) {
	capabilities := make([]guest.SandboxCapability, 0, len(values))
	for _, value := range values {
		capabilities = append(capabilities, guest.SandboxCapability(value))
	}
	return guest.NormalizeSandboxCapabilities(capabilities)
}

func toMicroVMRegistry(registry *machinev1alpha1.Registry) *types.Registry {
	if registry == nil {
		return nil
	}
	return &types.Registry{
		URL: registry.GetUrl(), Project: registry.Project,
		Username: registry.GetUsername(), Password: registry.GetPassword(),
	}
}

func toMicroVMRegistries(registries []*machinev1alpha1.Registry) []types.Registry {
	result := make([]types.Registry, 0, len(registries))
	for _, registry := range registries {
		if converted := toMicroVMRegistry(registry); converted != nil {
			result = append(result, *converted)
		}
	}
	return result
}
