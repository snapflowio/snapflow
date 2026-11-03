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
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/snapflowio/microvm-go/guestmemory"
	"github.com/snapflowio/microvm-go/hypervisor"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/network"
	"github.com/snapflowio/microvm-go/types"
)

const vmmTerminationGracePeriod = 2 * time.Second

func (b *Backend) startVMWithAssets(ctx context.Context, metadata state.InstanceMetadata, assets bootAssets) (hypervisor.Process, error) {
	vm, err := b.buildSpecWithAssets(ctx, metadata, assets)
	if err != nil {
		return hypervisor.Process{}, err
	}
	if err := validateVMSocketPaths(vm); err != nil {
		return hypervisor.Process{}, err
	}
	backend, err := b.hypervisorBackend(metadata.Hypervisor)
	if err != nil {
		return hypervisor.Process{}, err
	}
	return backend.Start(ctx, vm)
}

func validateVMSocketPaths(vm hypervisor.VM) error {
	for _, socket := range []struct {
		label string
		path  string
	}{
		{label: "API", path: vm.SocketPath},
		{label: "vsock", path: vm.VsockSocket},
	} {
		if strings.TrimSpace(socket.path) == "" {
			continue
		}
		if err := hypervisor.ValidateUnixSocketPath(socket.path); err != nil {
			return fmt.Errorf("validate microVM %s socket: %w", socket.label, err)
		}
	}
	return nil
}

func (b *Backend) buildSpec(ctx context.Context, metadata state.InstanceMetadata) (hypervisor.VM, error) {
	return b.buildSpecWithAssets(ctx, metadata, bootAssets{})
}

func (b *Backend) buildSpecWithAssets(ctx context.Context, metadata state.InstanceMetadata, assets bootAssets) (hypervisor.VM, error) {
	hypervisorBinary, err := b.resolveVMMBinary(ctx, metadata, assets)
	if err != nil {
		return hypervisor.VM{}, err
	}
	jailPaths, err := b.instanceJailPaths(metadata.ID)
	if err != nil {
		return hypervisor.VM{}, err
	}
	metadata.HypervisorBin = hypervisorBinary
	disks, err := instanceDisks(metadata)
	if err != nil {
		return hypervisor.VM{}, err
	}
	kernelPath, initrdPath, err := b.bootImagePaths(assets)
	if err != nil {
		return hypervisor.VM{}, err
	}
	bootPolicy := b.instanceBootPolicy(metadata)
	memoryFeatures := bootPolicy.memory.Features()
	serialLogPath := ""
	if bootPolicy.serialConsole {
		serialLogPath = b.paths.InstanceAppLog(metadata.ID)
	}
	return hypervisor.VM{
		ID:               metadata.ID,
		Hypervisor:       metadata.Hypervisor,
		HypervisorBin:    metadata.HypervisorBin,
		VCPUs:            int(maxInt64(1, metadata.CPUQuota)),
		MemoryBytes:      maxInt64(1, metadata.MemoryQuota) * bytesPerGiB,
		Disks:            disks,
		Networks:         b.instanceNetworks(metadata),
		SerialLogPath:    serialLogPath,
		VsockCID:         metadata.VsockCID,
		VsockSocket:      metadata.VsockSocket,
		PCIDevices:       pciDevices(metadata),
		KernelPath:       kernelPath,
		InitrdPath:       initrdPath,
		KernelArgs:       b.kernelArgsWithPolicy(metadata, bootPolicy),
		GuestMemory:      hypervisorMemoryConfig(memoryFeatures),
		SocketPath:       metadata.SocketPath,
		VMMLogPath:       b.paths.InstanceVMMLog(metadata.ID),
		NetworkNamespace: instanceNamespacePath(metadata),
		Jail:             jailPaths,
	}, nil
}

// instanceJailPaths creates the directories a jailed VMM writes to: its socket
// directory and its snapshots.
func (b *Backend) instanceJailPaths(instanceID string) (hypervisor.JailPaths, error) {
	writable := []string{b.paths.InstanceVMMDir(instanceID), b.paths.InstanceSnapshotsDir(instanceID)}
	for _, directory := range writable {
		if err := os.MkdirAll(directory, instanceVMMDirectoryMode); err != nil {
			return hypervisor.JailPaths{}, fmt.Errorf("create VMM directory %s: %w", directory, err)
		}
	}
	return hypervisor.JailPaths{Root: b.paths.InstanceJailRoot(instanceID), Writable: writable}, nil
}

func instanceNamespacePath(metadata state.InstanceMetadata) string {
	if metadata.Network == nil {
		return ""
	}
	return network.NamespacePath(metadata.Network.Namespace)
}

func (b *Backend) resolveVMMBinary(ctx context.Context, metadata state.InstanceMetadata, assets bootAssets) (string, error) {
	hypervisorBinary := metadata.HypervisorBin
	if assets.hypervisorBinary != "" {
		hypervisorBinary = assets.hypervisorBinary
	}
	if strings.TrimSpace(hypervisorBinary) == "" {
		resolved, err := b.hypervisorBinary(ctx, metadata.Hypervisor)
		if err != nil {
			return "", mvmerrors.New(
				http.StatusFailedDependency,
				fmt.Sprintf("hypervisor binary is not available for %s: %v", metadata.Hypervisor, err),
				"MICROVM_HYPERVISOR_UNAVAILABLE",
			)
		}
		hypervisorBinary = resolved
	}
	if _, err := os.Stat(hypervisorBinary); err != nil {
		return "", mvmerrors.New(
			http.StatusFailedDependency,
			fmt.Sprintf("hypervisor binary is not reachable: %v", err),
			"MICROVM_HYPERVISOR_UNAVAILABLE",
		)
	}
	return hypervisorBinary, nil
}

func instanceDisks(metadata state.InstanceMetadata) ([]hypervisor.Disk, error) {
	disks := []hypervisor.Disk{
		{Path: metadata.RootfsDisk, Readonly: true},
		{Path: metadata.OverlayDisk, Readonly: false, Direct: metadata.RawRequest.DirectIO},
		{Path: metadata.ConfigDisk, Readonly: true},
	}
	disks = append(disks, metadata.AdditionalDisks...)
	for _, disk := range disks {
		if _, err := os.Stat(disk.Path); err != nil {
			return nil, fmt.Errorf("microvm disk %s is not readable: %w", disk.Path, err)
		}
	}
	return disks, nil
}

func (b *Backend) instanceNetworks(metadata state.InstanceMetadata) []hypervisor.Network {
	allocation := metadata.Network
	if allocation == nil {
		return nil
	}
	return []hypervisor.Network{{
		TAPDevice: allocation.TAPDevice,
		IP:        allocation.IP,
		MAC:       allocation.MAC,
		Netmask:   allocation.Netmask,
	}}
}

func (b *Backend) bootImagePaths(assets bootAssets) (string, string, error) {
	if assets.kernelPath != "" && assets.initrdPath != "" {
		return assets.kernelPath, assets.initrdPath, nil
	}
	if err := b.validateBootPrerequisites(); err != nil {
		return "", "", err
	}
	return b.kernelPath, b.initrdPath, nil
}

func (b *Backend) stopVM(ctx context.Context, metadata *state.InstanceMetadata) error {
	return b.stopVMWithOptions(ctx, metadata, types.StopOptions{})
}

func (b *Backend) stopVMWithOptions(ctx context.Context, metadata *state.InstanceMetadata, options types.StopOptions) error {
	if metadata == nil {
		return nil
	}
	process := b.runningProcess(ctx, *metadata)
	if !options.Force {
		if backend, err := b.hypervisorBackend(metadata.Hypervisor); err == nil {
			if shutdownErr := backend.Shutdown(ctx, metadata.SocketPath); shutdownErr != nil {
				slog.DebugContext(ctx, "VMM shutdown was unavailable; terminating the VMM process", "instance_id", metadata.ID, "hypervisor", metadata.Hypervisor, "error", shutdownErr)
			}
		}
	}
	gracePeriod := options.GracePeriod
	if gracePeriod == 0 {
		gracePeriod = vmmTerminationGracePeriod
	}
	if err := hypervisor.Terminate(process, gracePeriod); err != nil {
		return fmt.Errorf("terminate microvm process: %w", err)
	}
	b.removeProcessArtifacts(ctx, *metadata)
	return nil
}

func (b *Backend) processRunning(ctx context.Context, metadata state.InstanceMetadata) bool {
	return b.runningProcess(ctx, metadata).Running()
}

func (b *Backend) runningProcess(ctx context.Context, metadata state.InstanceMetadata) hypervisor.Process {
	if process, err := hypervisor.ReadPID(b.paths.InstancePID(metadata.ID)); err == nil {
		return process
	}
	if metadata.SocketPath == "" || !hypervisor.IsSocketInUse(ctx, metadata.SocketPath) {
		return hypervisor.Process{}
	}
	process, err := hypervisor.ResolveProcess(metadata.SocketPath)
	if err != nil {
		return hypervisor.Process{}
	}
	if err := hypervisor.WritePID(b.paths.InstancePID(metadata.ID), process); err != nil {
		slog.Warn("could not repair runtime PID record", "instance_id", metadata.ID, "pid", process.PID, "error", err)
	}
	return process
}

func (b *Backend) killVM(ctx context.Context, metadata state.InstanceMetadata, process hypervisor.Process) error {
	if err := hypervisor.Kill(process); err != nil {
		return fmt.Errorf("kill microvm process: %w", err)
	}
	b.removeProcessArtifacts(ctx, metadata)
	return nil
}

func (b *Backend) removeProcessArtifacts(ctx context.Context, metadata state.InstanceMetadata) {
	for description, path := range map[string]string{
		"PID record": b.paths.InstancePID(metadata.ID),
		"VMM socket": metadata.SocketPath,
		"vsock":      metadata.VsockSocket,
	} {
		if err := removeRuntimeSocketPath(path); err != nil {
			slog.WarnContext(ctx, "could not remove stopped instance process artifact", "instance_id", metadata.ID, "artifact", description, "path", path, "error", err)
		}
	}
	if err := b.releaseVMMResources(metadata); err != nil {
		slog.WarnContext(ctx, "could not release stopped instance VMM resources", "instance_id", metadata.ID, "error", err)
	}
}

func removeRuntimeSocketPath(path string) error {
	if strings.TrimSpace(path) == "" {
		return nil
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

func (b *Backend) releaseNetwork(ctx context.Context, metadata state.InstanceMetadata) error {
	policyErr := b.networks.RemoveEgressPolicy(ctx, metadata.ID)
	if metadata.Network == nil {
		return policyErr
	}
	releaseErr := b.networks.Release(ctx, metadata.Network)
	return errors.Join(policyErr, releaseErr)
}

func (b *Backend) hypervisorBinary(ctx context.Context, hv hypervisor.Hypervisor) (string, error) {
	return b.vmmBinaries.Resolve(ctx, hv)
}

func (b *Backend) runtimeSocketPaths(instanceID string, hv hypervisor.Hypervisor) (string, string) {
	return b.paths.InstanceSocket(instanceID, hypervisor.APISocketName(hv)), b.paths.InstanceVsock(instanceID)
}

func hypervisorMemoryConfig(features guestmemory.Features) hypervisor.GuestMemoryConfig {
	return hypervisor.GuestMemoryConfig{
		EnableBalloon:     features.EnableBalloon,
		FreePageReporting: features.FreePageReporting,
		DeflateOnOOM:      features.DeflateOnOOM,
		FreePageHinting:   features.FreePageHinting,
	}
}

func pciDevices(metadata state.InstanceMetadata) []string {
	if len(metadata.PCIDevices) > 0 {
		return append([]string(nil), metadata.PCIDevices...)
	}
	raw := metadata.Labels["snapflow.io/pci.devices"]
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	devices := make([]string, 0, len(parts))
	for _, part := range parts {
		value := strings.TrimSpace(part)
		if value != "" {
			devices = append(devices, value)
		}
	}
	return devices
}

func maxInt64(minValue, value int64) int64 {
	if value < minValue {
		return minValue
	}
	return value
}
