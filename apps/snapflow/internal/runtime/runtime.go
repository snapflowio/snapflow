// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package runtime

import (
	"context"
	"net"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const StaleAssignmentErrorCode = "MICROVM_ASSIGNMENT_GENERATION_STALE"

type Assignment struct {
	SandboxID  string
	Generation uint32
}

type MaterializeRequest struct {
	Assignment Assignment
	Spec       *machinev1alpha1.SandboxSpec
	Secrets    *machinev1alpha1.SandboxSecrets
	Start      bool
}

type StartResult struct {
	DaemonVersion string
}

type ImageInfo struct {
	Reference  string
	SizeBytes  int64
	Entrypoint []string
	Command    []string
	Digest     string
}

type ImageDigest struct {
	Digest    string
	SizeBytes int64
}

type ServiceHealth struct {
	Name    string
	Healthy bool
	Error   error
}

type PlatformArtifact struct {
	Name            string
	Digest          string
	Platform        string
	Capabilities    []string
	ProtocolVersion int
}

type Capabilities struct {
	KVMAvailable                 bool
	CgroupV2Available            bool
	FirecrackerSnapshotAvailable bool
	FirecrackerTemplateAvailable bool
	Hypervisors                  []string
	FirecrackerVersion           string
	CloudHypervisorVersion       string
	MachineReleaseVersion        string
	MachineReleaseDigest         string
	ControlProtocolVersion       int
	MachineIdentity              string
	FirecrackerIdentity          string
	CloudHypervisorIdentity      string
	KernelIdentity               string
	InitrdIdentity               string
	GuestPlatforms               []string
	PreparedImageDigests         []string
	PreparedTemplateKeys         []string
	GuestReleaseDigest           string
	PlatformArtifacts            []PlatformArtifact
	Features                     []string
	BuilderImage                 string
}

type Inventory interface {
	RuntimeInventory(context.Context) ([]microvmtypes.RuntimeObservation, error)
}

type Sandboxes interface {
	Inventory
	Materialize(context.Context, MaterializeRequest) (StartResult, error)
	Adopt(context.Context, Assignment) error
	Start(context.Context, Assignment, map[string]string) (StartResult, error)
	Resume(context.Context, Assignment) (StartResult, error)
	Stop(context.Context, Assignment, bool) error
	Pause(context.Context, Assignment) error
	Resize(context.Context, Assignment, *machinev1alpha1.SandboxResources) error
	UpdateNetwork(context.Context, Assignment, *machinev1alpha1.NetworkPolicy) error
	Recover(context.Context, Assignment, *machinev1alpha1.SandboxRecovery, *machinev1alpha1.SandboxSpec) error
	DaemonVersion(context.Context, string) (string, error)
	Destroy(context.Context, string) error
}

type Images interface {
	BuildImage(context.Context, *machinev1alpha1.BuildSnapshotPayload) (string, error)
	PublishImage(context.Context, *machinev1alpha1.PublishSnapshotPayload) error
	PullImage(context.Context, string, *machinev1alpha1.Registry) error
	RemoveImage(context.Context, string) error
	ImageInfo(context.Context, string) (ImageInfo, error)
	InspectImageInRegistry(context.Context, string, *machinev1alpha1.Registry) (ImageDigest, error)
	BuilderImage() string
	BenchmarkImage() string
}

type Templates interface {
	PrepareTemplate(context.Context, string, *machinev1alpha1.TemplatePreparation) (string, error)
	RemoveTemplate(context.Context, string) error
}

type Checkpoints interface {
	CreateSnapshot(context.Context, Assignment, *machinev1alpha1.Registry) (ImageInfo, error)
}

type Backups interface {
	CreateBackup(context.Context, Assignment, *machinev1alpha1.CreateBackupPayload) (*machinev1alpha1.CreateBackupResult, error)
	BackupVolumes(context.Context, Assignment, *machinev1alpha1.BackupVolumesPayload) (*machinev1alpha1.BackupVolumesResult, error)
}

type Volumes interface {
	DeleteVolume(context.Context, string) error
	ResizeVolume(context.Context, string, *machinev1alpha1.ResizeVolumePayload) error
	RestoreVolume(context.Context, string, *machinev1alpha1.RestoreVolumePayload) error
}

type Diagnostics interface {
	Health(context.Context) []ServiceHealth
	Capabilities(context.Context) (Capabilities, error)
}

type GuestServices interface {
	GuestServiceTarget(context.Context, string, string) (*microvmtypes.ProxyTarget, error)
}

type UsageSampler interface {
	RuntimeUsageSample(context.Context, string) (microvmtypes.RuntimeUsageSample, error)
}

type RuntimePorts interface {
	DialRuntimePort(context.Context, string, microvmtypes.RuntimePortTarget) (net.Conn, error)
}

type SandboxRuntime interface {
	Sandboxes
	Images
	Templates
	Checkpoints
	Backups
	Volumes
	Diagnostics
	GuestServices
	RuntimePorts
}
