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

package microvm

import (
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/snapflowio/microvm-go/builds"
	"github.com/snapflowio/microvm-go/devices"
	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/host"
	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/admission"
	microvmruntime "github.com/snapflowio/microvm-go/internal/runtime"
	"github.com/snapflowio/microvm-go/internal/transferpolicy"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/microvm-go/vmm"
	"github.com/snapflowio/microvm-go/volumes"
)

type (
	Hypervisor             = hypervisor.Hypervisor
	HypervisorBackend      = microvmruntime.HypervisorBackend
	CreateRequest          = types.CreateRequest
	ImagePullPolicy        = types.ImagePullPolicy
	InitialState           = types.InitialState
	WorkloadInitialization = types.WorkloadInitialization
	ResizeRequest          = types.ResizeRequest
	StartOptions           = types.StartOptions
	ForkRequest            = types.ForkRequest
	RuntimeState           = types.RuntimeState
	PreparedBootAssets     = microvmruntime.PreparedBootAssets
	Capacity               = admission.Resources
	VolumeBlockStore       = volumes.BlockStore
	SandboxCapability      = guest.SandboxCapability
)

type HostAssets struct {
	FirecrackerPath     string
	CloudHypervisorPath string
	KernelPath          string
	InitrdPath          string
	MkfsErofsPath       string
}

type Config struct {
	DataDir           string
	DefaultHypervisor Hypervisor
	HostAssets        HostAssets
	SerialConsole     bool
	// HostServicePorts are host TCP ports guests reach at their gateway;
	// only development sets them.
	HostServicePorts       []uint16
	TemplateCacheEntries   int
	TemplateCacheBytes     int64
	TemplateBuildLimit     int
	TrustedTransferOrigins []string
	GuestBundles           []guest.Bundle
	GuestBundleRegistryURL string
	PinnedImages           []string
	BuilderImage           string
	HostGPU                host.HostGPUInfo
	Offered                Offer
}

type Dependencies struct {
	Hypervisors  map[Hypervisor]HypervisorBackend
	BuildLogPath func(string) (string, error)
}

type Option func(*options)

type options struct {
	volumeBlockStore VolumeBlockStore
	gpuManager       devices.GPUManager
}

func WithVolumeBlockStore(store VolumeBlockStore) Option {
	return func(o *options) { o.volumeBlockStore = store }
}

func WithGPUManager(manager devices.GPUManager) Option {
	return func(o *options) { o.gpuManager = manager }
}

const (
	Firecracker     Hypervisor = hypervisor.HypervisorFirecracker
	CloudHypervisor Hypervisor = hypervisor.HypervisorCloudHypervisor

	ImagePullIfNotPresent ImagePullPolicy = types.ImagePullIfNotPresent
	ImagePullAlways       ImagePullPolicy = types.ImagePullAlways
	ImagePullNever        ImagePullPolicy = types.ImagePullNever
	InitialStateRunning   InitialState    = types.InitialStateRunning
	InitialStateStopped   InitialState    = types.InitialStateStopped

	SandboxCapabilityDeveloperTools SandboxCapability = guest.SandboxCapabilityDeveloperTools
	SandboxCapabilityDesktop        SandboxCapability = guest.SandboxCapabilityDesktop
)

func New(config Config, dependencies Dependencies, opts ...Option) (*Runtime, error) {
	runtimeConfig, err := runtimeConfiguration(config, dependencies)
	if err != nil {
		return nil, err
	}
	applied := options{}
	for _, option := range opts {
		option(&applied)
	}
	runtimeConfig.VolumeBlockStore = applied.volumeBlockStore
	runtimeConfig.GPUDevices = applied.gpuManager
	backend, err := microvmruntime.NewBackend(runtimeConfig)
	if err != nil {
		return nil, err
	}
	return &Runtime{backend: backend}, nil
}

func runtimeConfiguration(config Config, dependencies Dependencies) (microvmruntime.Config, error) {
	dataDir := strings.TrimSpace(config.DataDir)
	if dataDir == "" || !filepath.IsAbs(dataDir) {
		return microvmruntime.Config{}, errors.New("microvm data directory must be an absolute path")
	}
	if len(dependencies.Hypervisors) == 0 {
		return microvmruntime.Config{}, errors.New("at least one hypervisor backend is required")
	}
	if err := validateHostAssets(config.HostAssets); err != nil {
		return microvmruntime.Config{}, err
	}
	if err := guest.ValidateBundles(config.GuestBundles); err != nil {
		return microvmruntime.Config{}, err
	}
	registry, err := guestBundleRegistry(config.GuestBundleRegistryURL)
	if err != nil {
		return microvmruntime.Config{}, err
	}
	transfers, err := transferpolicy.New(config.TrustedTransferOrigins)
	if err != nil {
		return microvmruntime.Config{}, err
	}
	passthroughGPUs, err := host.PassthroughGPUCount(config.HostGPU)
	if err != nil {
		return microvmruntime.Config{}, fmt.Errorf("detect host GPU capacity: %w", err)
	}
	paths := layout.NewPaths(filepath.Clean(dataDir))
	quarantine := devices.NewGPUQuarantine(paths.SystemGPUQuarantineDir())
	detect := func() (Capacity, error) { return defaultCapacity(dataDir) }
	capacity := capacityProbe(detect, listableGPUs(int64(passthroughGPUs), quarantine), config.Offered)
	enabled := make([]Hypervisor, 0, len(dependencies.Hypervisors))
	for value := range dependencies.Hypervisors {
		enabled = append(enabled, value)
	}
	return microvmruntime.Config{
		Paths:              paths,
		GPUQuarantine:      quarantine,
		DefaultHypervisor:  config.DefaultHypervisor,
		EnabledHypervisors: enabled,
		Hypervisors:        dependencies.Hypervisors,
		HostGPU:            config.HostGPU,
		KernelPath:         filepath.Clean(config.HostAssets.KernelPath),
		InitrdPath:         filepath.Clean(config.HostAssets.InitrdPath),
		MkfsErofsPath:      filepath.Clean(config.HostAssets.MkfsErofsPath),
		VMMAssets: vmm.HostAssets{
			Firecracker:     filepath.Clean(config.HostAssets.FirecrackerPath),
			CloudHypervisor: filepath.Clean(config.HostAssets.CloudHypervisorPath),
		},
		Builds:              builds.Config{LogPath: dependencies.BuildLogPath, BuilderImage: config.BuilderImage},
		Transfers:           transfers,
		Capacity:            capacity,
		GuestBundles:        append([]guest.Bundle(nil), config.GuestBundles...),
		GuestBundleRegistry: registry,
		PinnedImages:        append([]string(nil), config.PinnedImages...),
		SerialConsole:       config.SerialConsole,
		HostServicePorts:    append([]uint16(nil), config.HostServicePorts...),
		TemplateCacheLimit:  config.TemplateCacheEntries,
		TemplateCacheBytes:  config.TemplateCacheBytes,
		TemplateBuildLimit:  config.TemplateBuildLimit,
	}, nil
}

func validateHostAssets(assets HostAssets) error {
	for _, candidate := range []struct {
		name  string
		value string
	}{
		{name: "Firecracker", value: assets.FirecrackerPath},
		{name: "Cloud Hypervisor", value: assets.CloudHypervisorPath},
		{name: "kernel", value: assets.KernelPath},
		{name: "initrd", value: assets.InitrdPath},
		{name: "mkfs.erofs", value: assets.MkfsErofsPath},
	} {
		if !filepath.IsAbs(filepath.Clean(strings.TrimSpace(candidate.value))) {
			return fmt.Errorf("%s path must be absolute", candidate.name)
		}
	}
	return nil
}

func guestBundleRegistry(value string) (*types.Registry, error) {
	endpoint, err := url.Parse(strings.TrimSpace(value))
	if err != nil || endpoint.Host == "" {
		return nil, errors.New("guest bundle registry URL must be an absolute HTTP or HTTPS origin")
	}
	if endpoint.Scheme != "http" && endpoint.Scheme != "https" {
		return nil, errors.New("guest bundle registry URL must use HTTP or HTTPS")
	}
	if endpoint.User != nil || endpoint.Path != "" || endpoint.RawQuery != "" || endpoint.Fragment != "" {
		return nil, errors.New("guest bundle registry URL must not include credentials, path, query, or fragment")
	}
	return &types.Registry{URL: endpoint.String()}, nil
}

var ErrStaleAssignment = microvmruntime.ErrStaleAssignment

const StaleAssignmentErrorCode = microvmruntime.StaleAssignmentErrorCode

func ImageFormatterCheck(mkfsErofsPath string) func() error {
	return func() error {
		_, err := imagecache.NewErofsFormatter(imagecache.ErofsFormatterConfig{Path: mkfsErofsPath})
		return err
	}
}
