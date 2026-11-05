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
	"os"
	"runtime"
	"strings"
	"sync"

	"github.com/snapflowio/microvm-go/builds"
	"github.com/snapflowio/microvm-go/devices"
	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/guestmemory"
	"github.com/snapflowio/microvm-go/host"
	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/admission"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/snapshot"
	"github.com/snapflowio/microvm-go/internal/template"
	"github.com/snapflowio/microvm-go/internal/transferpolicy"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/network"
	"github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/microvm-go/vmm"
	"github.com/snapflowio/microvm-go/volumes"
	"golang.org/x/sync/singleflight"
)

const dataDirMode = 0o755

type Config struct {
	Paths               layout.Paths
	DefaultHypervisor   hypervisor.Hypervisor
	EnabledHypervisors  []hypervisor.Hypervisor
	Hypervisors         map[hypervisor.Hypervisor]HypervisorBackend
	HostGPU             host.HostGPUInfo
	KernelPath          string
	InitrdPath          string
	MkfsErofsPath       string
	VMMAssets           vmm.HostAssets
	Builds              builds.Config
	Transfers           transferpolicy.Policy
	GPUQuarantine       *devices.GPUQuarantine
	Capacity            func() (admission.Resources, error)
	GuestBundles        []guest.Bundle
	GuestBundleRegistry *types.Registry
	PinnedImages        []string
	SerialConsole       bool
	TemplateCacheLimit  int
	TemplateCacheBytes  int64
	TemplateBuildLimit  int
	HostServicePorts    []uint16
}

var _ builds.BuilderMachine = (*Backend)(nil)

type Backend struct {
	paths              layout.Paths
	images             *imagecache.ImageStore
	defaultHypervisor  hypervisor.Hypervisor
	enabledHypervisors map[hypervisor.Hypervisor]struct{}
	hypervisors        map[hypervisor.Hypervisor]HypervisorBackend
	hostGPU            host.HostGPUInfo
	kernelPath         string
	initrdPath         string
	vmmBinaries        vmm.Manager
	networks           *network.Manager
	networkConfig      network.Config
	gpuDevices         devices.GPUManager
	snapshots          snapshot.Store
	volumes            *volumes.Manager
	builds             *builds.Manager
	transfers          transferpolicy.Policy
	memory             guestmemory.Policy
	lifecycle          *lifecycle.Coordinator
	admission          *admission.Controller
	capacity           func() (admission.Resources, error)
	gpuAllocationMu    sync.Mutex
	overlayTemplates   singleflight.Group
	templates          *template.Cache
	pendingGPU         map[string][]string
	supervisionMu      sync.Mutex
	supervising        map[string]struct{}
	restoreSlots       map[hypervisor.Hypervisor]chan struct{}
	supportDiskSamples chan struct{}
	// prepareSnapshot creates a snapshot destination the jailed VMM can write.
	prepareSnapshot     func(instanceID, path string) error
	buildDiskMu         sync.Mutex
	buildDiskHolds      map[string]int
	background          sync.WaitGroup
	events              *lifecycle.EventBus
	guestBundleMu       sync.RWMutex
	guestBundles        []guest.Bundle
	guestBundleRegistry *types.Registry
	pinnedImages        []string
	serialConsole       bool
}

func NewBackend(config Config) (*Backend, error) {
	if strings.TrimSpace(config.Paths.DataDir()) == "" {
		return nil, errors.New("microvm data dir is required")
	}
	if err := os.MkdirAll(config.Paths.DataDir(), dataDirMode); err != nil {
		return nil, fmt.Errorf("create microvm data dir: %w", err)
	}
	enabledHypervisors, hypervisorBackends, err := enabledHypervisorBackends(config)
	if err != nil {
		return nil, err
	}
	memoryPolicy := guestmemory.DefaultPolicy().Normalize()
	formatter, err := imagecache.NewErofsFormatter(imagecache.ErofsFormatterConfig{Path: config.MkfsErofsPath})
	if err != nil {
		return nil, fmt.Errorf("configure EROFS formatter: %w", err)
	}
	images, err := imagecache.NewImageStore(imagecache.ImageStoreConfig{Paths: config.Paths, Formatter: formatter})
	if err != nil {
		return nil, fmt.Errorf("open prepared image store: %w", err)
	}
	networkConfig := network.DefaultConfig()
	networkConfig.HostServicePorts = config.HostServicePorts
	networkManager := network.NewManager(networkConfig)
	vmmBinaries, err := vmm.NewManager(config.VMMAssets)
	if err != nil {
		return nil, fmt.Errorf("configure immutable host assets: %w", err)
	}
	backend := &Backend{
		prepareSnapshot:     prepareSnapshotDirectory,
		paths:               config.Paths,
		images:              images,
		defaultHypervisor:   config.DefaultHypervisor,
		enabledHypervisors:  enabledHypervisors,
		hypervisors:         hypervisorBackends,
		hostGPU:             config.HostGPU,
		kernelPath:          strings.TrimSpace(config.KernelPath),
		initrdPath:          strings.TrimSpace(config.InitrdPath),
		vmmBinaries:         vmmBinaries,
		networks:            networkManager,
		networkConfig:       networkConfig,
		gpuDevices:          defaultGPUManager(config.HostGPU, gpuQuarantine(config)),
		snapshots:           snapshot.NewStore(config.Paths),
		volumes:             volumes.NewManager(config.Paths),
		memory:              memoryPolicy,
		lifecycle:           lifecycle.NewCoordinator(),
		pendingGPU:          make(map[string][]string),
		supervising:         make(map[string]struct{}),
		restoreSlots:        restoreSlots(hypervisorBackends),
		supportDiskSamples:  make(chan struct{}, 1),
		buildDiskHolds:      make(map[string]int),
		events:              lifecycle.NewEventBus(0),
		guestBundles:        append([]guest.Bundle(nil), config.GuestBundles...),
		guestBundleRegistry: cloneRegistry(config.GuestBundleRegistry),
		pinnedImages:        append([]string(nil), config.PinnedImages...),
		serialConsole:       config.SerialConsole,
		transfers:           config.Transfers,
		capacity:            config.Capacity,
	}
	backend.templates = template.New(template.Config{
		Paths:          config.Paths,
		CacheEntries:   config.TemplateCacheLimit,
		CacheBytes:     config.TemplateCacheBytes,
		BuildLimit:     config.TemplateBuildLimit,
		CloneAvailable: host.FirecrackerTemplateCloneCompatibility(config.Paths.DataDir()) == nil,
	}, templateSeeds{backend: backend})
	buildConfig := config.Builds
	buildConfig.HostGateway = network.GatewayIP
	buildManager, err := builds.NewManager(config.Paths, images, backend, buildConfig, config.Transfers)
	if err != nil {
		return nil, fmt.Errorf("initialize isolated builder: %w", err)
	}
	backend.builds = buildManager
	if backend.admission, err = backend.newAdmission(); err != nil {
		return nil, err
	}
	return backend, nil
}

func enabledHypervisorBackends(
	config Config,
) (map[hypervisor.Hypervisor]struct{}, map[hypervisor.Hypervisor]HypervisorBackend, error) {
	if !hypervisor.SupportedOnHost(config.DefaultHypervisor) {
		return nil, nil, fmt.Errorf(
			"hypervisor %q is not supported on %s; use %s",
			config.DefaultHypervisor, runtime.GOOS, hypervisor.DefaultForHost(),
		)
	}
	enabled := make(map[hypervisor.Hypervisor]struct{}, len(config.EnabledHypervisors))
	backends := make(map[hypervisor.Hypervisor]HypervisorBackend, len(config.EnabledHypervisors))
	for _, candidate := range config.EnabledHypervisors {
		if !hypervisor.SupportedOnHost(candidate) {
			return nil, nil, fmt.Errorf("enabled hypervisor %s is not supported on %s", candidate, runtime.GOOS)
		}
		backend, found := config.Hypervisors[candidate]
		if !found || backend == nil {
			return nil, nil, fmt.Errorf("enabled hypervisor %s has no backend", candidate)
		}
		enabled[candidate] = struct{}{}
		backends[candidate] = backend
	}
	if _, found := enabled[config.DefaultHypervisor]; !found {
		return nil, nil, fmt.Errorf("default hypervisor %s is not enabled", config.DefaultHypervisor)
	}
	return enabled, backends, nil
}

func (b *Backend) Recover(ctx context.Context) error {
	if err := os.RemoveAll(b.paths.SystemBuildsDir()); err != nil {
		return fmt.Errorf("clear interrupted build workspaces: %w", err)
	}
	report, err := b.reconcile(ctx)
	if err != nil {
		return fmt.Errorf("reconcile microvm runtime state: %w", err)
	}
	for instanceID, instanceErr := range report.Failed {
		slog.ErrorContext(ctx, "quarantined instance that could not be reconciled", "instance_id", instanceID, "error", instanceErr)
	}
	if err := b.sweepReleasedVMMResources(); err != nil {
		slog.WarnContext(ctx, "could not release idle VMM resources", "error", err)
	}
	if err := b.resynchronizeAllocations(ctx); err != nil {
		return fmt.Errorf("account microvm resource allocations: %w", err)
	}
	if err := b.templates.Prune(ctx, ""); err != nil {
		slog.WarnContext(ctx, "could not fully enforce runtime template cache limit", "error", err)
	}
	return nil
}

func cloneRegistry(registry *types.Registry) *types.Registry {
	if registry == nil {
		return nil
	}
	cloned := *registry
	if registry.Project != nil {
		project := *registry.Project
		cloned.Project = &project
	}
	return &cloned
}

func defaultGPUManager(gpuInfo host.HostGPUInfo, quarantine *devices.GPUQuarantine) devices.GPUManager {
	inventory := make([]devices.GPUInventoryDevice, 0, len(gpuInfo.Devices))
	for _, device := range gpuInfo.Devices {
		inventory = append(inventory, devices.GPUInventoryDevice{
			PCIAddress: device.PCIAddress,
			Model:      device.Model,
		})
	}
	return devices.NewGPUManager(inventory, quarantine)
}

func (b *Backend) bundlesForCapabilities(capabilities []guest.SandboxCapability) ([]guest.Bundle, error) {
	b.guestBundleMu.RLock()
	bundles := cloneGuestBundles(b.guestBundles)
	b.guestBundleMu.RUnlock()
	return guest.SelectBundles(bundles, capabilities)
}

func (b *Backend) platformBundleRegistry() *types.Registry {
	b.guestBundleMu.RLock()
	defer b.guestBundleMu.RUnlock()
	return cloneRegistry(b.guestBundleRegistry)
}

func cloneGuestBundles(bundles []guest.Bundle) []guest.Bundle {
	cloned := make([]guest.Bundle, len(bundles))
	for index := range bundles {
		cloned[index] = bundles[index]
		cloned[index].Capabilities = append([]guest.SandboxCapability(nil), bundles[index].Capabilities...)
		cloned[index].Components = append([]guest.Manifest(nil), bundles[index].Components...)
	}
	return cloned
}

func gpuQuarantine(config Config) *devices.GPUQuarantine {
	if config.GPUQuarantine != nil {
		return config.GPUQuarantine
	}
	return devices.NewGPUQuarantine(config.Paths.SystemGPUQuarantineDir())
}
