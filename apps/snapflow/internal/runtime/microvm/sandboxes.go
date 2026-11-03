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
	"maps"

	"github.com/snapflowio/microvm-go/types"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

func (runtime *Runtime) Materialize(ctx context.Context, request sandboxruntime.MaterializeRequest) (sandboxruntime.StartResult, error) {
	if fork := request.Spec.GetFork(); fork != nil {
		return runtime.fork(ctx, request, fork.GetSourceSandboxId())
	}
	return runtime.create(ctx, request)
}

func (runtime *Runtime) create(ctx context.Context, request sandboxruntime.MaterializeRequest) (sandboxruntime.StartResult, error) {
	createRequest, err := toMicroVMCreateRequest(request)
	if err != nil {
		return sandboxruntime.StartResult{}, err
	}
	defer workload.ClearSecrets(createRequest.SecretEnv)
	if !capabilitiesAreSupported(createRequest.Capabilities, runtime.supportedCapabilities) {
		return sandboxruntime.StartResult{}, fmt.Errorf("sandbox capabilities %v are unavailable on this machine", createRequest.Capabilities)
	}
	instanceID, err := runtime.engine.Create(ctx, createRequest)
	if err != nil {
		return sandboxruntime.StartResult{}, err
	}
	if !request.Start {
		return sandboxruntime.StartResult{}, nil
	}
	return runtime.readyResult(ctx, instanceID)
}

func (runtime *Runtime) fork(ctx context.Context, request sandboxruntime.MaterializeRequest, sourceID string) (sandboxruntime.StartResult, error) {
	targetID := request.Assignment.SandboxID
	secretEnv := maps.Clone(request.Secrets.GetEnv())
	defer workload.ClearSecrets(secretEnv)
	instanceID, err := runtime.engine.Fork(ctx, sourceID, types.ForkRequest{
		ID:                   targetID,
		Start:                request.Start,
		SecretEnv:            secretEnv,
		AssignmentGeneration: int(request.Assignment.Generation),
	})
	if err != nil {
		return sandboxruntime.StartResult{}, err
	}
	if instanceID != targetID {
		return sandboxruntime.StartResult{}, fmt.Errorf("fork returned runtime identity %q, expected %q", instanceID, targetID)
	}
	if !request.Start {
		return sandboxruntime.StartResult{}, nil
	}
	return runtime.readyResult(ctx, instanceID)
}

func (runtime *Runtime) Adopt(ctx context.Context, assignment sandboxruntime.Assignment) error {
	return runtime.engine.AdmitAssignment(ctx, assignment.SandboxID, int(assignment.Generation))
}

func (runtime *Runtime) Start(
	ctx context.Context,
	assignment sandboxruntime.Assignment,
	secretEnv map[string]string,
) (sandboxruntime.StartResult, error) {
	if err := runtime.engine.Start(ctx, assignment.SandboxID, types.StartOptions{
		SecretEnv:            secretEnv,
		AssignmentGeneration: int(assignment.Generation),
	}); err != nil {
		return sandboxruntime.StartResult{}, err
	}
	return runtime.readyResult(ctx, assignment.SandboxID)
}

func (runtime *Runtime) Resume(ctx context.Context, assignment sandboxruntime.Assignment) (sandboxruntime.StartResult, error) {
	if err := runtime.Adopt(ctx, assignment); err != nil {
		return sandboxruntime.StartResult{}, err
	}
	if err := runtime.engine.Resume(ctx, assignment.SandboxID); err != nil {
		return sandboxruntime.StartResult{}, err
	}
	return runtime.readyResult(ctx, assignment.SandboxID)
}

func (runtime *Runtime) Stop(ctx context.Context, assignment sandboxruntime.Assignment, force bool) error {
	return runtime.engine.StopWithOptions(ctx, assignment.SandboxID, types.StopOptions{
		Force:                force,
		AssignmentGeneration: int(assignment.Generation),
	})
}

func (runtime *Runtime) Pause(ctx context.Context, assignment sandboxruntime.Assignment) error {
	if err := runtime.Adopt(ctx, assignment); err != nil {
		return err
	}
	return runtime.engine.Standby(ctx, assignment.SandboxID)
}

func (runtime *Runtime) Resize(
	ctx context.Context,
	assignment sandboxruntime.Assignment,
	resources *machinev1alpha1.SandboxResources,
) error {
	info, err := runtime.engine.RuntimeInfo(ctx, assignment.SandboxID)
	if err != nil {
		return fmt.Errorf("inspect sandbox before resize: %w", err)
	}
	cpu := int64(resources.GetCpuQuota())
	memory := int64(resources.GetMemoryQuota())
	request := types.ResizeRequest{CPU: &cpu, Memory: &memory, AssignmentGeneration: int(assignment.Generation)}
	if storage := int64(resources.GetStorageQuota()); storage > info.StorageGiB {
		request.Storage = &storage
	}
	return runtime.engine.Resize(ctx, assignment.SandboxID, request)
}

func (runtime *Runtime) UpdateNetwork(
	ctx context.Context,
	assignment sandboxruntime.Assignment,
	policy *machinev1alpha1.NetworkPolicy,
) error {
	if err := runtime.Adopt(ctx, assignment); err != nil {
		return err
	}
	return runtime.engine.UpdateNetworkSettings(ctx, assignment.SandboxID, toMicroVMNetworkSettings(policy))
}

func (runtime *Runtime) DaemonVersion(ctx context.Context, id string) (string, error) {
	version, err := runtime.toolboxVersion(ctx, id)
	if err != nil {
		return "", fmt.Errorf("verify toolbox readiness for sandbox %s: %w", id, err)
	}
	return version, nil
}

func (runtime *Runtime) Destroy(ctx context.Context, id string) error {
	return runtime.engine.Destroy(ctx, id)
}

func (runtime *Runtime) readyResult(ctx context.Context, id string) (sandboxruntime.StartResult, error) {
	version, err := runtime.DaemonVersion(ctx, id)
	if err != nil {
		return sandboxruntime.StartResult{}, err
	}
	return sandboxruntime.StartResult{DaemonVersion: version}, nil
}
