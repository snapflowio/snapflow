// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package microvm

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"slices"
	"strings"
	"time"

	distributionreference "github.com/distribution/reference"
	"github.com/opencontainers/go-digest"
	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/host"
	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/types"
	microvmvolumes "github.com/snapflowio/microvm-go/volumes"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
)

const (
	initialLifecycleGeneration     = 1
	initialSpecificationGeneration = 0
	toolboxVersionKey              = "version"
	toolboxReadinessTimeout        = 30 * time.Second
	profileLabel                   = hypervisor.InstanceProfileLabel
	sandboxNameLabel               = "snapflow.io/sandbox.name"
	snapshotDefaultProject         = "snapflow"
	snapshotImagePrefix            = "snapflow-"
	snapshotImageTag               = "snapflow"
	storageRecoveryIncrement       = int64(5)
	storageRecoveryMaximum         = int64(10)
	percentageBase                 = int64(100)
	pausedRuntimeUsageState        = "paused"
)

type microvmEngine interface {
	Create(context.Context, types.CreateRequest) (string, error)
	AdmitAssignment(context.Context, string, int) error
	Destroy(context.Context, string) error
	Start(context.Context, string, types.StartOptions) error
	StopWithOptions(context.Context, string, types.StopOptions) error
	Resume(context.Context, string) error
	Standby(context.Context, string) error
	Fork(context.Context, string, types.ForkRequest) (string, error)
	Resize(context.Context, string, types.ResizeRequest) error
	RuntimeInfo(context.Context, string) (types.RuntimeInfo, error)
	PrepareTemplate(context.Context, types.CreateRequest) (string, error)
	RemoveTemplate(context.Context, string) error
	RuntimeInventory(context.Context) ([]types.RuntimeObservation, error)
	PreparedImageDigests(context.Context) ([]string, error)
	PreparedTemplateKeys(context.Context) ([]string, error)
	ExportInstanceImage(context.Context, string, types.ExportImageRequest) (types.ImageInfo, error)
	PullImage(context.Context, string, *types.Registry, string) error
	BuildImage(context.Context, types.BuildRequest) error
	TagImage(context.Context, string, string) error
	PushImage(context.Context, string, *types.Registry) error
	RemoveImage(context.Context, string) error
	ImageInfo(context.Context, string) (types.ImageInfo, error)
	InspectImage(context.Context, string, *types.Registry, string) (types.ImageInfo, error)
	UpdateNetworkSettings(context.Context, string, types.NetworkSettings) error
	RuntimeUsageSample(context.Context, string) (types.RuntimeUsageSample, error)
	EnsureVolume(context.Context, microvmvolumes.EnsureRequest) (types.Volume, error)
	DeleteVolume(context.Context, string) error
	ResizeVolume(context.Context, string, int64) (types.Volume, error)
	CreateInstanceVolumeBackup(context.Context, string, types.CreateInstanceVolumeBackup) ([]types.InstanceVolumeBackupResult, error)
	RestoreVolumeBackup(context.Context, string, types.RestoreVolumeBackup) error
	AllocatedResources(context.Context) (types.AllocatedResources, error)
	Capacity(context.Context) (types.AllocatedResources, error)
	ImageCount(context.Context) (int, error)
	GuestServiceTarget(context.Context, string, string) (*types.ProxyTarget, error)
	DialRuntimePort(context.Context, string, types.RuntimePortTarget) (net.Conn, error)
}

type RuntimeConfig struct {
	Engine                  microvmEngine
	Preflight               host.PreflightReport
	GuestReleaseDigest      string
	PlatformArtifacts       []sandboxruntime.PlatformArtifact
	SupportedCapabilities   []guest.SandboxCapability
	KernelIdentity          string
	InitrdIdentity          string
	GuestPlatforms          []string
	ToolboxReadinessTimeout time.Duration
	FirecrackerVersion      string
	CloudHypervisorVersion  string
	MachineReleaseVersion   string
	MachineReleaseDigest    string
	ControlProtocolVersion  int
	MachineIdentity         string
	FirecrackerIdentity     string
	CloudHypervisorIdentity string
	BuilderImage            string
	BenchmarkImage          string
	GuestRegistryURL        string
}

var _ sandboxruntime.SandboxRuntime = (*Runtime)(nil)

type Runtime struct {
	engine                  microvmEngine
	preflight               host.PreflightReport
	guestReleaseDigest      string
	platformArtifacts       []sandboxruntime.PlatformArtifact
	supportedCapabilities   []guest.SandboxCapability
	kernelIdentity          string
	initrdIdentity          string
	guestPlatforms          []string
	toolboxReadinessTimeout time.Duration
	firecrackerVersion      string
	cloudHypervisorVersion  string
	machineReleaseVersion   string
	machineReleaseDigest    string
	controlProtocolVersion  int
	machineIdentity         string
	firecrackerIdentity     string
	cloudHypervisorIdentity string
	builderImage            string
	benchmarkImage          string
	guestRegistry           *types.Registry
	guestRegistryHost       string
}

func NewRuntime(cfg RuntimeConfig) (*Runtime, error) {
	if cfg.Engine == nil {
		return nil, errors.New("microVM engine is required")
	}
	releaseDigest := strings.TrimSpace(cfg.GuestReleaseDigest)
	if _, err := digest.Parse(releaseDigest); err != nil {
		return nil, fmt.Errorf("guest release digest must be an immutable OCI digest: %w", err)
	}
	if len(cfg.PlatformArtifacts) == 0 {
		return nil, errors.New("at least one prepared guest platform artifact is required")
	}
	if len(cfg.GuestPlatforms) == 0 {
		return nil, errors.New("at least one guest platform is required")
	}
	if strings.TrimSpace(cfg.BuilderImage) == "" {
		return nil, errors.New("builder image is required")
	}
	if err := requireDigestPinned(cfg.BenchmarkImage); err != nil {
		return nil, fmt.Errorf("benchmark image: %w", err)
	}
	guestRegistry, err := url.Parse(strings.TrimSpace(cfg.GuestRegistryURL))
	if err != nil || guestRegistry.Host == "" {
		return nil, errors.New("guest registry URL must be an absolute origin")
	}
	identities := []string{
		cfg.MachineReleaseDigest,
		cfg.MachineIdentity,
		cfg.FirecrackerIdentity,
		cfg.CloudHypervisorIdentity,
		cfg.KernelIdentity,
		cfg.InitrdIdentity,
	}
	for _, identity := range identities {
		if parsed, err := digest.Parse(strings.TrimSpace(identity)); err != nil || parsed.Algorithm() != digest.SHA256 {
			return nil, errors.New("the Snapflow release and host asset identities must be SHA-256 digests")
		}
	}
	supportedCapabilities, err := guest.NormalizeSandboxCapabilities(cfg.SupportedCapabilities)
	if err != nil {
		return nil, fmt.Errorf("supported sandbox capabilities: %w", err)
	}
	timeout := cfg.ToolboxReadinessTimeout
	if timeout <= 0 {
		timeout = toolboxReadinessTimeout
	}

	return &Runtime{
		engine:                  cfg.Engine,
		preflight:               cfg.Preflight,
		guestReleaseDigest:      releaseDigest,
		platformArtifacts:       clonePlatformArtifacts(cfg.PlatformArtifacts),
		supportedCapabilities:   supportedCapabilities,
		kernelIdentity:          strings.TrimSpace(cfg.KernelIdentity),
		initrdIdentity:          strings.TrimSpace(cfg.InitrdIdentity),
		guestPlatforms:          slices.Clone(cfg.GuestPlatforms),
		toolboxReadinessTimeout: timeout,
		firecrackerVersion:      strings.TrimSpace(cfg.FirecrackerVersion),
		cloudHypervisorVersion:  strings.TrimSpace(cfg.CloudHypervisorVersion),
		machineReleaseVersion:   strings.TrimSpace(cfg.MachineReleaseVersion),
		machineReleaseDigest:    strings.TrimSpace(cfg.MachineReleaseDigest),
		controlProtocolVersion:  cfg.ControlProtocolVersion,
		machineIdentity:         strings.TrimSpace(cfg.MachineIdentity),
		firecrackerIdentity:     strings.TrimSpace(cfg.FirecrackerIdentity),
		cloudHypervisorIdentity: strings.TrimSpace(cfg.CloudHypervisorIdentity),
		builderImage:            strings.TrimSpace(cfg.BuilderImage),
		benchmarkImage:          strings.TrimSpace(cfg.BenchmarkImage),
		guestRegistry:           &types.Registry{URL: guestRegistry.String()},
		guestRegistryHost:       guestRegistry.Host,
	}, nil
}

func (runtime *Runtime) BuilderImage() string {
	return runtime.builderImage
}

func (runtime *Runtime) BenchmarkImage() string {
	return runtime.benchmarkImage
}

func requireDigestPinned(image string) error {
	named, err := distributionreference.ParseNormalizedNamed(strings.TrimSpace(image))
	if err != nil {
		return err
	}
	if _, pinned := named.(distributionreference.Digested); !pinned {
		return errors.New("the image must be pinned by digest")
	}
	return nil
}

func capabilitiesAreSupported(requested, supported []guest.SandboxCapability) bool {
	for _, capability := range requested {
		if !slices.Contains(supported, capability) {
			return false
		}
	}
	return true
}
