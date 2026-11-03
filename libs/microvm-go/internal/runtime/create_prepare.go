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
	"os"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/imagecache"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/vsock"
	"github.com/snapflowio/microvm-go/network"
	"github.com/snapflowio/microvm-go/types"
)

const (
	prepareGPUPhase            = "prepare_gpu_ms"
	prepareDiskPhase           = "prepare_disk_ms"
	prepareVolumesPhase        = "prepare_volumes_ms"
	preparePlatformPhase       = "prepare_platform_bundles_ms"
	prepareIdentityPhase       = "prepare_identity_ms"
	prepareNetworkPhase        = "prepare_network_ms"
	prepareEgressPhase         = "prepare_egress_ms"
	prepareConfigDrivePhase    = "prepare_config_drive_ms"
	prepareBootAssetsPhase     = "prepare_boot_assets_wait_ms"
	prepareMetadataCommitPhase = "prepare_metadata_commit_ms"
	prepareLinkedPeerPhase     = "prepare_linked_peer_ms"
	instanceLogsDirectoryMode  = 0o755
	instanceVMMDirectoryMode   = 0o700
)

type createSpec struct {
	request           types.CreateRequest
	record            imagecache.ImageRecord
	platform          imagecache.Platform
	hypervisor        hypervisor.Hypervisor
	requiresSecretEnv bool
	options           createOptions
}

func (b *Backend) prepareCreate(ctx context.Context, spec createSpec, timer *phaseTimer) (state.InstanceMetadata, bootAssets, error) {
	assetsContext, cancelAssets := context.WithCancel(ctx)
	defer cancelAssets()
	type bootAssetsResult struct {
		assets bootAssets
		err    error
	}
	assetsReady := make(chan bootAssetsResult, 1)
	go func() {
		assets, resolveErr := b.resolveBootAssets(assetsContext, spec.hypervisor)
		assetsReady <- bootAssetsResult{assets: assets, err: resolveErr}
	}()

	metadata, err := b.prepareInstance(ctx, spec, timer)
	if err != nil {
		cancelAssets()
		<-assetsReady
		return metadata, bootAssets{}, b.releasePreparation(ctx, err, &metadata)
	}
	var assetsResult bootAssetsResult
	if err := timer.time(prepareBootAssetsPhase, func() error {
		assetsResult = <-assetsReady
		return assetsResult.err
	}); err != nil {
		return metadata, bootAssets{}, b.releasePreparation(ctx, fmt.Errorf("prepare microVM boot assets: %w", err), &metadata)
	}
	metadata.HypervisorBin = assetsResult.assets.hypervisorBinary
	if err := timer.time(prepareMetadataCommitPhase, func() error {
		return runLifecycleAction(b, metadata.ID, lifecycle.OperationMetadataCommit, func() error {
			return b.writeInstance(metadata)
		})
	}); err != nil {
		return metadata, bootAssets{}, b.releasePreparation(ctx, err, &metadata)
	}
	return metadata, assetsResult.assets, nil
}

func (b *Backend) releasePreparation(ctx context.Context, cause error, metadata *state.InstanceMetadata) error {
	err := cause
	if len(metadata.GPUAssignments) > 0 {
		err = errors.Join(err, wrapOptionalError("release GPU lease after preparation failure", b.releaseGPUDevices(context.WithoutCancel(ctx), metadata)))
	}
	if len(metadata.VolumeAttachments) > 0 {
		err = errors.Join(err, wrapOptionalError("detach instance volumes after preparation failure", b.detachVolumeAttachments(context.WithoutCancel(ctx), *metadata)))
	}
	if instanceHasNetwork(*metadata) {
		err = errors.Join(err, wrapOptionalError("release instance network after preparation failure", b.releaseNetwork(context.WithoutCancel(ctx), *metadata)))
	}
	return err
}

func (b *Backend) prepareInstance(ctx context.Context, spec createSpec, timer *phaseTimer) (state.InstanceMetadata, error) {
	metadata := b.newInstanceMetadata(spec)
	if spec.request.GPUQuota > 0 {
		if err := timer.time(prepareGPUPhase, func() error {
			return b.assignInstanceGPUs(ctx, &metadata)
		}); err != nil {
			return metadata, err
		}
		defer b.finishGPUAssignment(metadata.ID)
	}
	for _, step := range b.instancePreparationSteps(ctx, spec, &metadata) {
		if err := timer.time(step.phase, step.run); err != nil {
			return metadata, err
		}
	}
	return metadata, nil
}

type preparationStep struct {
	phase string
	run   func() error
}

func (b *Backend) newInstanceMetadata(spec createSpec) state.InstanceMetadata {
	request := spec.request
	metadata := state.NewInstanceMetadata(request, spec.hypervisor, spec.platform)
	metadata.TemplateSeed = spec.options.templateSeed
	metadata.RequiresSecretEnv = spec.requiresSecretEnv
	metadata.ResolvedImage = spec.record.Repository + "@" + spec.record.Digest
	metadata.RootfsDisk = b.paths.ImageDisk(spec.record.Repository, spec.record.DigestHex())
	metadata.OverlayDisk = b.paths.InstanceOverlay(request.ID)
	metadata.ConfigDisk = b.paths.InstanceConfigDisk(request.ID)
	metadata.SocketPath, metadata.VsockSocket = b.runtimeSocketPaths(request.ID, spec.hypervisor)
	metadata.VsockCID = vsock.GuestCID
	metadata.State = types.RuntimeStateCreating
	return metadata
}

func (b *Backend) assignInstanceGPUs(ctx context.Context, metadata *state.InstanceMetadata) error {
	gpuAssignments, err := b.assignGPUDevices(ctx, *metadata)
	if err != nil {
		return err
	}
	metadata.GPUAssignments = gpuAssignments
	metadata.PCIDevices = gpuPCIPaths(gpuAssignments)
	return nil
}

func (b *Backend) instancePreparationSteps(ctx context.Context, spec createSpec, metadata *state.InstanceMetadata) []preparationStep {
	request := spec.request
	guestAssetPlatform := spec.record.Platform
	return []preparationStep{
		{phase: prepareDiskPhase, run: func() error {
			return runLifecycleAction(b, metadata.ID, lifecycle.OperationDiskPreparation, func() error {
				if err := os.MkdirAll(b.paths.InstanceLogsDir(request.ID), instanceLogsDirectoryMode); err != nil {
					return fmt.Errorf("create instance logs directory: %w", err)
				}
				return b.createOverlayDisk(ctx, metadata.OverlayDisk, request.StorageQuota)
			})
		}},
		{phase: prepareVolumesPhase, run: func() error {
			return runLifecycleAction(b, metadata.ID, lifecycle.OperationVolumePreparation, func() error {
				return b.prepareVolumeAttachments(ctx, metadata, request.Volumes)
			})
		}},
		{phase: preparePlatformPhase, run: func() error {
			return b.preparePlatformBundles(ctx, metadata, guestAssetPlatform)
		}},
		{phase: prepareIdentityPhase, run: func() error {
			return runLifecycleAction(b, metadata.ID, lifecycle.OperationIdentityPreparation, func() error {
				return initializeInstanceIdentity(metadata)
			})
		}},
		{phase: prepareNetworkPhase, run: func() error {
			return b.allocateInstanceNetwork(ctx, metadata)
		}},
		{phase: prepareEgressPhase, run: func() error {
			return b.applyInstanceEgressPolicy(ctx, *metadata)
		}},
		{phase: prepareConfigDrivePhase, run: func() error {
			return runLifecycleAction(b, metadata.ID, lifecycle.OperationConfigDrive, func() error {
				return b.writeInstanceConfigDrive(*metadata, spec.record)
			})
		}},
	}
}

func (b *Backend) allocateInstanceNetwork(ctx context.Context, metadata *state.InstanceMetadata) error {
	allocation, err := runLifecycleOperation(b, metadata.ID, "", lifecycle.OperationNetworkAllocation, func() (*network.Allocation, error) {
		return b.networks.Allocate(ctx, metadata.ID)
	})
	if err != nil {
		return err
	}
	applyNetworkAllocation(metadata, allocation)
	return nil
}

func (b *Backend) applyInstanceEgressPolicy(ctx context.Context, metadata state.InstanceMetadata) error {
	policy, err := instanceEgressPolicy(metadata)
	if err != nil {
		return mvmerrors.NewInvalidRequest(err)
	}
	if err := runLifecycleAction(b, metadata.ID, lifecycle.OperationEgressPolicy, func() error {
		return b.networks.ApplyEgressPolicy(ctx, instancePolicyBinding(metadata, policy))
	}); err != nil {
		return fmt.Errorf("apply instance egress policy: %w", err)
	}
	return nil
}
