// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package microvm

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	goruntime "runtime"
	"slices"

	"github.com/snapflowio/common-go/pkg/guestspec"
	microvmgo "github.com/snapflowio/microvm-go"
	"github.com/snapflowio/microvm-go/builds"
	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/host"
	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/hypervisor/cloudhypervisor"
	"github.com/snapflowio/microvm-go/hypervisor/firecracker"
	"github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/guestrelease"
	"github.com/snapflowio/snapflow/internal/release"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"golang.org/x/sync/errgroup"
)

const (
	fileIdentityPrefix      = "sha256:"
	requiredHypervisorCount = 2

	AllAdmittable = microvmgo.AllAdmittable
)

type Offer = microvmgo.Offer

type EngineConfig struct {
	DataDir                string
	Release                release.VerifiedRelease
	GuestRegistryURL       string
	DesktopEnabled         bool
	SerialConsoleEnabled   bool
	HostServicePorts       []uint16
	TemplateCacheEntries   int
	TemplateCacheBytes     int64
	TemplateBuildLimit     int
	Offer                  Offer
	TrustedTransferOrigins []string
	BuildLogPath           func(string) (string, error)
	Preflight              host.PreflightReport
	HostGPU                host.HostGPUInfo
}

type Engine struct {
	Runtime *Runtime
	engine  *microvmgo.Runtime
}

func (engine *Engine) Run(ctx context.Context) error {
	return engine.engine.Run(ctx)
}

func Open(ctx context.Context, cfg EngineConfig) (*Engine, error) {
	platform := goruntime.GOOS + "/" + goruntime.GOARCH
	manifest := cfg.Release.Manifest
	guestRelease, err := guestrelease.Resolve(ctx, manifest.Guest.Reference, cfg.GuestRegistryURL, platform)
	if err != nil {
		return nil, err
	}
	if cfg.DesktopEnabled && !releaseSupportsArtifact(guestRelease, guestspec.DesktopArtifactName) {
		return nil, errors.New("microVM desktop support is enabled but the signed guest release has no desktop extension")
	}
	engine, err := microvmgo.New(engineConfig(cfg, guestRelease), microvmgo.Dependencies{
		Hypervisors: map[hypervisor.Hypervisor]microvmgo.HypervisorBackend{
			hypervisor.HypervisorFirecracker:     firecracker.NewBackend(),
			hypervisor.HypervisorCloudHypervisor: cloudhypervisor.NewBackend(),
		},
		BuildLogPath: cfg.BuildLogPath,
	})
	if err != nil {
		return nil, fmt.Errorf("open microVM engine: %w", err)
	}
	if err := engine.Recover(ctx); err != nil {
		return nil, fmt.Errorf("recover microVM engine state: %w", err)
	}
	supported := supportedCapabilities(cfg.DesktopEnabled)
	prepared, err := prepareEngine(ctx, engine, platform, supported)
	if err != nil {
		return nil, err
	}
	workloadRuntime, err := NewRuntime(RuntimeConfig{
		Engine: engine, Preflight: cfg.Preflight,
		GuestReleaseDigest: guestRelease.Digest, PlatformArtifacts: selectArtifacts(guestRelease, prepared.bundles),
		SupportedCapabilities: supported,
		KernelIdentity:        prepared.kernelIdentity, InitrdIdentity: prepared.initrdIdentity,
		FirecrackerVersion:      manifest.FileVersion(release.RoleFirecracker),
		CloudHypervisorVersion:  manifest.FileVersion(release.RoleCloudHypervisor),
		MachineReleaseVersion:   manifest.Version,
		MachineReleaseDigest:    cfg.Release.BundleDigest,
		ControlProtocolVersion:  manifest.Guest.ControlProtocolVersion,
		MachineIdentity:         manifest.FileIdentity(release.RoleSnapflowd),
		FirecrackerIdentity:     manifest.FileIdentity(release.RoleFirecracker),
		CloudHypervisorIdentity: manifest.FileIdentity(release.RoleCloudHypervisor),
		GuestPlatforms:          []string{platform},
		BuilderImage:            builds.DefaultBuilderImage,
		BenchmarkImage:          guestRelease.BenchmarkImage,
		GuestRegistryURL:        cfg.GuestRegistryURL,
	})
	if err != nil {
		return nil, fmt.Errorf("initialize microVM workload runtime: %w", err)
	}
	return &Engine{Runtime: workloadRuntime, engine: engine}, nil
}

func engineConfig(cfg EngineConfig, guestRelease *guestrelease.Release) microvmgo.Config {
	return microvmgo.Config{
		DataDir:           cfg.DataDir,
		DefaultHypervisor: microvmgo.CloudHypervisor,
		HostAssets: microvmgo.HostAssets{
			FirecrackerPath:     cfg.Release.Assets.Firecracker,
			CloudHypervisorPath: cfg.Release.Assets.CloudHypervisor,
			MkfsErofsPath:       cfg.Release.Assets.MkfsErofs,
			KernelPath:          cfg.Release.Assets.Kernel,
			InitrdPath:          cfg.Release.Assets.Initrd,
		},
		SerialConsole:          cfg.SerialConsoleEnabled,
		HostServicePorts:       cfg.HostServicePorts,
		TemplateCacheEntries:   cfg.TemplateCacheEntries,
		TemplateCacheBytes:     cfg.TemplateCacheBytes,
		TemplateBuildLimit:     cfg.TemplateBuildLimit,
		TrustedTransferOrigins: cfg.TrustedTransferOrigins,
		GuestBundles:           guestRelease.Bundles,
		GuestBundleRegistryURL: cfg.GuestRegistryURL,
		PinnedImages:           []string{guestRelease.BenchmarkImage},
		BuilderImage:           builds.DefaultBuilderImage,
		HostGPU:                cfg.HostGPU,
		Offered:                cfg.Offer,
	}
}

func supportedCapabilities(desktopEnabled bool) []guest.SandboxCapability {
	supported := []guest.SandboxCapability{guest.SandboxCapabilityDeveloperTools}
	if desktopEnabled {
		supported = append(supported, guest.SandboxCapabilityDesktop)
		slices.Sort(supported)
	}
	return supported
}

type preparedEngine struct {
	bundles        []types.PreparedPlatformBundle
	kernelIdentity string
	initrdIdentity string
}

func prepareEngine(
	ctx context.Context,
	engine *microvmgo.Runtime,
	platform string,
	supported []guest.SandboxCapability,
) (preparedEngine, error) {
	var bootAssets microvmgo.PreparedBootAssets
	var prepared preparedEngine
	var preparedHypervisors map[hypervisor.Hypervisor]string
	group, groupContext := errgroup.WithContext(ctx)
	group.Go(func() error {
		var err error
		preparedHypervisors, err = engine.PrepareHypervisors(
			groupContext,
			hypervisor.HypervisorFirecracker,
			hypervisor.HypervisorCloudHypervisor,
		)
		return err
	})
	group.Go(func() error {
		var err error
		bootAssets, err = engine.PrepareBootAssets(groupContext, platform)
		return err
	})
	group.Go(func() error {
		var err error
		prepared.bundles, err = engine.PreparePlatformBundles(groupContext, platform, supported)
		return err
	})
	if err := group.Wait(); err != nil {
		return preparedEngine{}, fmt.Errorf("prepare microVM runtime: %w", err)
	}
	if len(preparedHypervisors) != requiredHypervisorCount {
		return preparedEngine{}, errors.New("prepare microVM runtime: complete hypervisor set was not verified")
	}
	var err error
	if prepared.kernelIdentity, err = fileIdentity(bootAssets.KernelPath); err != nil {
		return preparedEngine{}, fmt.Errorf("identify prepared kernel: %w", err)
	}
	if prepared.initrdIdentity, err = fileIdentity(bootAssets.InitrdPath); err != nil {
		return preparedEngine{}, fmt.Errorf("identify prepared initrd: %w", err)
	}
	return prepared, nil
}

func selectArtifacts(guestRelease *guestrelease.Release, bundles []types.PreparedPlatformBundle) []sandboxruntime.PlatformArtifact {
	selected := make([]sandboxruntime.PlatformArtifact, 0, len(bundles))
	for _, prepared := range bundles {
		for _, candidate := range guestRelease.Artifacts {
			if candidate.Name == prepared.Name {
				selected = append(selected, candidate)
				break
			}
		}
	}
	return selected
}

func releaseSupportsArtifact(guestRelease *guestrelease.Release, name string) bool {
	for _, artifact := range guestRelease.Artifacts {
		if artifact.Name == name {
			return true
		}
	}
	return false
}

func fileIdentity(filePath string) (identity string, resultErr error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer func() {
		if err := file.Close(); err != nil {
			resultErr = errors.Join(resultErr, err)
		}
	}()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return fileIdentityPrefix + hex.EncodeToString(hash.Sum(nil)), nil
}

func HostPreflight(dataDir, mkfsErofsPath string) (host.PreflightReport, error) {
	return host.Preflight(host.PreflightConfig{
		DataDir:             dataDir,
		CheckImageFormatter: microvmgo.ImageFormatterCheck(mkfsErofsPath),
	})
}
