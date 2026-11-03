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
	"net"
	"os"
	"time"

	"github.com/snapflowio/microvm-go/builds"
	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/admission"
	"github.com/snapflowio/microvm-go/internal/configdrive"
	"github.com/snapflowio/microvm-go/internal/diskusage"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/vsock"
	"github.com/snapflowio/microvm-go/network"
	"github.com/snapflowio/microvm-go/types"
)

const (
	internalBuilderLabel      = "snapflow.io/internal-builder"
	internalBuilderLabelValue = "true"
	builderOSUser             = "root"
	builderHome               = "/root"
	builderWorkdir            = "/"
	builderPath               = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
	builderInitMode           = "exec"
	builderStateDevice        = "/dev/vdd"
	builderStateMountMode     = "rw"
	builderEnvironmentEntries = 2
	buildDiskAllocationPrefix = "__build__:"
)

func isInternalBuilder(metadata state.InstanceMetadata) bool {
	return metadata.Labels[internalBuilderLabel] == internalBuilderLabelValue
}

func (b *Backend) StartBuilder(ctx context.Context, spec builds.BuilderSpec) (builds.BuilderPhases, error) {
	return runLifecycleOperation(b, spec.ID, "", lifecycle.OperationBuild, func() (builds.BuilderPhases, error) {
		return b.startBuilder(ctx, spec)
	})
}

func (b *Backend) startBuilder(ctx context.Context, spec builds.BuilderSpec) (phases builds.BuilderPhases, returnErr error) {
	if spec.ID == "" {
		return builds.BuilderPhases{}, errors.New("builder VM ID is required")
	}
	guard, err := b.lifecycle.Lock(ctx, spec.ID)
	if err != nil {
		return builds.BuilderPhases{}, fmt.Errorf("acquire builder lifecycle lock: %w", err)
	}
	defer guard.Release()

	reservation, err := b.reserveBuilderResources(ctx, spec)
	if err != nil {
		return builds.BuilderPhases{}, err
	}
	defer reservation.Finish()

	transaction := lifecycle.NewTransaction()
	defer func() {
		if rollbackErr := transaction.Rollback(ctx); rollbackErr != nil {
			returnErr = errors.Join(returnErr, rollbackErr)
		}
	}()
	if err := transaction.Defer("builder instance directory", func(context.Context) error {
		return b.removeInstanceStateDirectories(spec.ID)
	}); err != nil {
		return builds.BuilderPhases{}, err
	}

	imageStartedAt := time.Now()
	record, err := b.images.Ensure(ctx, spec.BuilderImage, nil, spec.Platform, types.ImagePullIfNotPresent)
	if err != nil {
		return builds.BuilderPhases{}, fmt.Errorf("materialize builder image: %w", err)
	}
	phases.BuilderImage = time.Since(imageStartedAt)
	prepareStartedAt := time.Now()
	metadata, err := b.prepareBuilder(ctx, spec, record, transaction)
	if err != nil {
		return builds.BuilderPhases{}, err
	}
	reservation.Finish()
	phases.Prepare = time.Since(prepareStartedAt)

	launchStartedAt := time.Now()
	if err := b.launchBuilder(ctx, metadata, transaction); err != nil {
		return builds.BuilderPhases{}, err
	}
	phases.Launch = time.Since(launchStartedAt)
	transaction.Commit()
	return phases, nil
}

func (b *Backend) ReserveBuildDisk(ctx context.Context, id string) error {
	b.buildDiskMu.Lock()
	defer b.buildDiskMu.Unlock()
	if b.buildDiskHolds[id] == 0 {
		headroom, err := b.buildDiskHeadroom(id)
		if err != nil {
			return err
		}
		b.reclaimTemplateDisk(ctx, headroom)
		if err := b.admission.Admit(buildDiskAllocationPrefix+id, admission.Resources{DiskGiB: headroom}); err != nil {
			return admissionError("reserve build disk", err)
		}
	}
	b.buildDiskHolds[id]++
	return nil
}

func (b *Backend) ReleaseBuildDisk(id string) {
	b.buildDiskMu.Lock()
	defer b.buildDiskMu.Unlock()
	b.buildDiskHolds[id]--
	if b.buildDiskHolds[id] > 0 {
		return
	}
	delete(b.buildDiskHolds, id)
	b.admission.Remove(buildDiskAllocationPrefix + id)
	b.requestSupportDiskSample()
}

func (b *Backend) buildDiskHeadroom(id string) (int64, error) {
	metadata, err := b.readBuilder(id)
	if err != nil {
		return 0, err
	}
	disks := []string{b.paths.InstanceOverlay(id)}
	for _, disk := range metadata.AdditionalDisks {
		disks = append(disks, disk.Path)
	}
	usedGiB := diskusage.FilesAllocatedBytes(disks) / bytesPerGiB
	return max(0, metadata.StorageQuota+metadata.AdditionalDiskQuota-usedGiB), nil
}

func (b *Backend) reserveBuilderResources(ctx context.Context, spec builds.BuilderSpec) (*resourceReservation, error) {
	resources := requestedResources(spec.CPUVCPUs, spec.MemoryGiB, 0, 0)
	if b.networks.Capacity() > 0 {
		resources.NetworkSlots = 1
	}
	if err := b.validateResourceShape(resources); err != nil {
		return nil, err
	}
	return b.reserveResources(ctx, spec.ID, resources)
}

func (b *Backend) prepareBuilder(
	ctx context.Context,
	spec builds.BuilderSpec,
	record imagecache.ImageRecord,
	transaction *lifecycle.Transaction,
) (state.InstanceMetadata, error) {
	hv := hypervisor.HypervisorCloudHypervisor
	platform, err := imagecache.ParsePlatform(record.Platform)
	if err != nil {
		return state.InstanceMetadata{}, err
	}
	if err := requireNativePlatform(platform); err != nil {
		return state.InstanceMetadata{}, err
	}
	createRequest := types.CreateRequest{
		ID:           spec.ID,
		Image:        spec.BuilderImage,
		Platform:     spec.Platform,
		CPUQuota:     spec.CPUVCPUs,
		MemoryQuota:  spec.MemoryGiB,
		StorageQuota: spec.WorkspaceGiB,
		Labels:       map[string]string{internalBuilderLabel: internalBuilderLabelValue},
	}
	metadata, err := b.prepareBuilderInstance(ctx, createRequest, record, platform, hv)
	if err != nil {
		if instanceHasNetwork(metadata) {
			err = errors.Join(err, wrapOptionalError("release builder network after preparation failure", b.releaseNetwork(context.WithoutCancel(ctx), metadata)))
		}
		return state.InstanceMetadata{}, err
	}
	if instanceHasNetwork(metadata) {
		if err := transaction.Defer("builder network", func(rollbackCtx context.Context) error {
			return b.releaseNetwork(rollbackCtx, metadata)
		}); err != nil {
			return state.InstanceMetadata{}, err
		}
	}
	metadata.AdditionalDisks = []hypervisor.Disk{{Path: spec.StateDisk, Readonly: false}}
	metadata.AdditionalDiskQuota = spec.WorkspaceGiB
	if err := b.writeBuilderConfigDrive(metadata, record.Env, spec); err != nil {
		return state.InstanceMetadata{}, err
	}
	if err := b.writeInstance(metadata); err != nil {
		return state.InstanceMetadata{}, err
	}
	return metadata, nil
}

func (b *Backend) launchBuilder(ctx context.Context, metadata state.InstanceMetadata, transaction *lifecycle.Transaction) error {
	process, err := b.startVMWithAssets(ctx, metadata, bootAssets{})
	if err != nil {
		return err
	}
	if err := transaction.Defer("builder VMM process", func(context.Context) error {
		return b.terminateVMM(metadata, process)
	}); err != nil {
		return err
	}
	metadata.PID = process.PID
	now := time.Now().UTC()
	metadata.StartedAt = &now
	if err := hypervisor.WritePID(b.paths.InstancePID(metadata.ID), process); err != nil {
		return fmt.Errorf("persist builder VMM PID: %w", err)
	}
	if err := b.persistRuntimeState(&metadata, types.RuntimeStateStarted); err != nil {
		return fmt.Errorf("persist builder runtime metadata: %w", err)
	}
	return nil
}

func (b *Backend) StopBuilder(ctx context.Context, id string) error {
	guard, err := b.lifecycle.Lock(ctx, id)
	if err != nil {
		return fmt.Errorf("acquire builder lifecycle lock: %w", err)
	}
	defer guard.Release()
	metadata, err := b.readBuilder(id)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	return b.reconcileInternalBuilder(ctx, metadata)
}

func (b *Backend) DialBuilder(ctx context.Context, id string, port uint16) (net.Conn, error) {
	guard, err := b.lifecycle.ReadLock(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("acquire builder lifecycle read lock: %w", err)
	}
	defer guard.Release()
	metadata, err := b.readBuilder(id)
	if err != nil {
		return nil, err
	}
	if metadata.Network == nil {
		return nil, fmt.Errorf("builder %s has no network", id)
	}
	return b.networks.DialGuest(ctx, *metadata.Network, string(types.RuntimePortTCP), int(port))
}

func (b *Backend) BuilderLogs(id string) builds.BuilderLogs {
	return builds.BuilderLogs{
		Application: readLogFile(b.paths.InstanceAppLog(id)),
		VMM:         readLogFile(b.paths.InstanceVMMLog(id)),
	}
}

func (b *Backend) readBuilder(id string) (state.InstanceMetadata, error) {
	metadata, err := state.ReadInstanceMetadata(b.paths, id)
	if err != nil {
		return state.InstanceMetadata{}, err
	}
	if !isInternalBuilder(metadata) {
		return state.InstanceMetadata{}, mvmerrors.NewInvalidRequest(fmt.Errorf("instance %s is not an internal builder", id))
	}
	return metadata, nil
}

func (b *Backend) writeBuilderConfigDrive(metadata state.InstanceMetadata, imageEnv map[string]string, spec builds.BuilderSpec) error {
	env := make(map[string]string, len(imageEnv)+builderEnvironmentEntries)
	for key, value := range imageEnv {
		env[key] = value
	}
	env["HOME"] = builderHome
	env["PATH"] = builderPath
	cfg := configdrive.Config{
		OSUser:         builderOSUser,
		Entrypoint:     append([]string(nil), spec.Command...),
		Workdir:        builderWorkdir,
		Env:            env,
		InitMode:       builderInitMode,
		Hostname:       instanceHostname(metadata.ID),
		MachineID:      instanceMachineID(metadata.ID),
		RequireCgroups: true,
		VolumeMounts: []configdrive.VolumeMount{
			{Device: builderStateDevice, Path: spec.StateMount, Mode: builderStateMountMode},
		},
		InjectedFilePath: spec.ConfigFile.Path,
		InjectedFile:     spec.ConfigFile.Content,
	}
	cfg.GuestInit.InstanceID = metadata.ID
	cfg.GuestInit.GenerationID = metadata.GenerationID
	cfg.GuestInit.ControlAuthToken = metadata.ControlAuthToken
	if allocation := metadata.Network; allocation != nil {
		cfg.NetworkMode = configdrive.NetworkModeStatic
		cfg.GuestIP = allocation.IP
		cfg.GuestCIDR = configdrive.CIDRFromNetmask(allocation.Netmask)
		cfg.GuestGW = allocation.Gateway
		cfg.GuestDNS = allocation.DNS
	}
	if err := configdrive.Write(metadata.ConfigDisk, cfg); err != nil {
		return fmt.Errorf("create builder config drive: %w", err)
	}
	return nil
}

func (b *Backend) prepareBuilderInstance(
	ctx context.Context,
	request types.CreateRequest,
	record imagecache.ImageRecord,
	platform imagecache.Platform,
	hv hypervisor.Hypervisor,
) (state.InstanceMetadata, error) {
	metadata := state.NewInstanceMetadata(request, hv, platform)
	if err := initializeInstanceIdentity(&metadata); err != nil {
		return metadata, err
	}
	metadata.ResolvedImage = record.Repository + "@" + record.Digest
	metadata.RootfsDisk = b.paths.ImageDisk(record.Repository, record.DigestHex())
	metadata.OverlayDisk = b.paths.InstanceOverlay(request.ID)
	metadata.ConfigDisk = b.paths.InstanceConfigDisk(request.ID)
	metadata.SocketPath, metadata.VsockSocket = b.runtimeSocketPaths(request.ID, hv)
	metadata.VsockCID = vsock.GuestCID
	metadata.State = types.RuntimeStateCreating

	hypervisorBinary, err := b.hypervisorBinary(ctx, hv)
	if err != nil {
		return metadata, err
	}
	metadata.HypervisorBin = hypervisorBinary
	if err := os.MkdirAll(b.paths.InstanceLogsDir(request.ID), filemode.SharedDirectory); err != nil {
		return metadata, fmt.Errorf("create builder logs directory: %w", err)
	}
	if err := b.createOverlayDisk(ctx, metadata.OverlayDisk, request.StorageQuota); err != nil {
		return metadata, err
	}
	allocation, err := b.networks.Allocate(ctx, request.ID)
	if err != nil {
		return metadata, err
	}
	applyBuilderNetwork(&metadata, allocation)
	return metadata, nil
}

func applyBuilderNetwork(metadata *state.InstanceMetadata, allocation *network.Allocation) {
	if metadata == nil || allocation == nil {
		return
	}
	metadata.NetworkEnabled = true
	metadata.Network = allocation
}

func readLogFile(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return string(data)
}
