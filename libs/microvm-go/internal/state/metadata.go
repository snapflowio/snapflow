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

package state

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/snapflowio/microvm-go/devices"
	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/healthcheck"
	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/network"
	"github.com/snapflowio/microvm-go/restartpolicy"
	"github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/microvm-go/volumes"
)

const metadataFileMode = 0o600

type InstanceMetadata struct {
	Identity                 types.RuntimeArtifactIdentity `json:"identity"`
	ID                       string                        `json:"id"`
	UserID                   string                        `json:"userId"`
	Image                    string                        `json:"image"`
	ResolvedImage            string                        `json:"resolvedImage,omitempty"`
	Platform                 string                        `json:"platform"`
	Hypervisor               hypervisor.Hypervisor         `json:"hypervisor"`
	HypervisorBin            string                        `json:"hypervisorBin,omitempty"`
	OSUser                   string                        `json:"osUser"`
	CPUQuota                 int64                         `json:"cpuQuota"`
	GPUQuota                 int64                         `json:"gpuQuota"`
	GPUType                  string                        `json:"gpuType,omitempty"`
	PCIDevices               []string                      `json:"pciDevices,omitempty"`
	GPUAssignments           []devices.GPUDevice           `json:"gpuAssignments,omitempty"`
	MemoryQuota              int64                         `json:"memoryQuota"`
	StorageQuota             int64                         `json:"storageQuota"`
	AdditionalDiskQuota      int64                         `json:"additionalDiskQuota,omitempty"`
	RootfsDisk               string                        `json:"rootfsDisk,omitempty"`
	OverlayDisk              string                        `json:"overlayDisk,omitempty"`
	ConfigDisk               string                        `json:"configDisk,omitempty"`
	AdditionalDisks          []hypervisor.Disk             `json:"additionalDisks,omitempty"`
	PlatformBundles          []PlatformBundleMetadata      `json:"platformBundles,omitempty"`
	VolumeAttachments        []volumes.MountedVolume       `json:"volumeAttachments,omitempty"`
	SocketPath               string                        `json:"socketPath,omitempty"`
	VsockCID                 int64                         `json:"vsockCid,omitempty"`
	VsockSocket              string                        `json:"vsockSocket,omitempty"`
	PID                      int                           `json:"pid,omitempty"`
	NetworkEnabled           bool                          `json:"networkEnabled"`
	Network                  *network.Allocation           `json:"network,omitempty"`
	LinkedPeer               *LinkedPeerMetadata           `json:"linkedPeer,omitempty"`
	Env                      map[string]string             `json:"env,omitempty"`
	RequiresSecretEnv        bool                          `json:"requiresSecretEnv,omitempty"`
	Labels                   map[string]string             `json:"labels,omitempty"`
	Entrypoint               []string                      `json:"entrypoint,omitempty"`
	ForkSourceInstanceID     string                        `json:"forkSourceInstanceId,omitempty"`
	State                    types.RuntimeState            `json:"state"`
	GuestServices            []guest.Service               `json:"guestServices,omitempty"`
	GuestServiceTokens       map[string]string             `json:"guestServiceTokens,omitempty"`
	NetworkMeter             NetworkMeter                  `json:"networkMeter"`
	UsageSequence            uint64                        `json:"usageSequence"`
	RunningMeter             RunningMeter                  `json:"runningMeter"`
	CreatedAt                time.Time                     `json:"createdAt"`
	UpdatedAt                time.Time                     `json:"updatedAt"`
	StartedAt                *time.Time                    `json:"startedAt,omitempty"`
	FirstSuccessfulCommandAt *time.Time                    `json:"firstSuccessfulCommandAt,omitempty"`
	StoppedAt                *time.Time                    `json:"stoppedAt,omitempty"`
	ExitCode                 *int                          `json:"exitCode,omitempty"`
	ExitMessage              string                        `json:"exitMessage,omitempty"`
	SnapshotIdentityQuiesced bool                          `json:"snapshotIdentityQuiesced,omitempty"`
	SnapshotFailureCode      string                        `json:"snapshotFailureCode,omitempty"`
	SnapshotInvalidatedAt    *time.Time                    `json:"snapshotInvalidatedAt,omitempty"`
	RestoreIdentityPending   bool                          `json:"restoreIdentityPending,omitempty"`
	GenerationID             string                        `json:"generationId"`
	GuestProtocolVersion     int                           `json:"guestProtocolVersion,omitempty"`
	GuestBuildDigest         string                        `json:"guestBuildDigest,omitempty"`
	GuestBootID              string                        `json:"guestBootId,omitempty"`
	GuestKeyID               string                        `json:"guestKeyId,omitempty"`
	GuestObservedAt          *time.Time                    `json:"guestObservedAt,omitempty"`
	ControlAuthToken         string                        `json:"controlAuthToken"`
	SnapshotControlAuthToken string                        `json:"snapshotControlAuthToken,omitempty"`
	RestoreControlAuthToken  string                        `json:"restoreControlAuthToken,omitempty"`
	TemplateSeed             bool                          `json:"templateSeed,omitempty"`
	TemplateKey              string                        `json:"templateKey,omitempty"`
	WorkloadInitialized      bool                          `json:"workloadInitialized,omitempty"`
	HealthCheck              *healthcheck.Policy           `json:"healthCheck,omitempty"`
	HealthCheckRuntime       *healthcheck.Runtime          `json:"healthCheckRuntime,omitempty"`
	RestartPolicy            *restartpolicy.Policy         `json:"restartPolicy,omitempty"`
	RestartStatus            restartpolicy.Status          `json:"restartStatus,omitempty"`
	ManualStop               bool                          `json:"manualStop,omitempty"`
	RawRequest               types.CreateRequest           `json:"rawRequest"`
}

type LinkedPeerMetadata struct {
	InstanceID string `json:"instanceId"`
	// TransitAddress is where this instance reaches the peer.
	TransitAddress string   `json:"transitAddress"`
	Aliases        []string `json:"aliases"`
}

type PlatformBundleMetadata struct {
	Name          string                    `json:"name"`
	Version       string                    `json:"version"`
	ReleaseDigest string                    `json:"releaseDigest"`
	Required      bool                      `json:"required"`
	Reference     string                    `json:"reference"`
	Digest        string                    `json:"digest"`
	Platform      string                    `json:"platform"`
	DiskPath      string                    `json:"diskPath"`
	Device        string                    `json:"device"`
	Filesystem    guest.FilesystemFormat    `json:"filesystem"`
	MountPath     string                    `json:"mountPath"`
	Capabilities  []guest.SandboxCapability `json:"capabilities"`
	Components    []guest.Manifest          `json:"components"`
}

func NewInstanceMetadata(request types.CreateRequest, hv hypervisor.Hypervisor, platform imagecache.Platform) InstanceMetadata {
	persistentRequest := types.PersistentCreateRequest(request)
	now := time.Now().UTC()
	return InstanceMetadata{
		Identity:      request.Identity,
		ID:            request.ID,
		UserID:        request.UserID,
		Image:         request.Image,
		Platform:      platform.String(),
		Hypervisor:    hv,
		OSUser:        request.OSUser,
		CPUQuota:      request.CPUQuota,
		GPUQuota:      request.GPUQuota,
		GPUType:       request.GPUType,
		MemoryQuota:   request.MemoryQuota,
		StorageQuota:  request.StorageQuota,
		Env:           cloneStringMap(request.Env),
		Labels:        cloneStringMap(request.Labels),
		Entrypoint:    append([]string(nil), request.Entrypoint...),
		HealthCheck:   request.HealthCheck,
		RestartPolicy: request.RestartPolicy,
		State:         types.RuntimeStateCreating,
		CreatedAt:     now,
		UpdatedAt:     now,
		RawRequest:    persistentRequest,
		TemplateKey:   "",
	}
}

func ReadInstanceMetadata(paths layout.Paths, id string) (InstanceMetadata, error) {
	if err := ValidateInstanceID(id); err != nil {
		return InstanceMetadata{}, err
	}
	data, err := os.ReadFile(paths.InstanceMetadata(id))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return InstanceMetadata{}, os.ErrNotExist
		}
		return InstanceMetadata{}, fmt.Errorf("read instance metadata %s: %w", id, err)
	}

	var metadata InstanceMetadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		return InstanceMetadata{}, fmt.Errorf("decode instance metadata %s: %w", id, err)
	}
	return metadata, nil
}

func WriteInstanceMetadata(paths layout.Paths, metadata InstanceMetadata) error {
	if err := ValidateInstanceID(metadata.ID); err != nil {
		return err
	}
	metadata.UpdatedAt = time.Now().UTC()
	data, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return fmt.Errorf("encode instance metadata %s: %w", metadata.ID, err)
	}
	target := paths.InstanceMetadata(metadata.ID)
	if err := atomicfile.Replace(target, data, metadataFileMode); err != nil {
		return fmt.Errorf("install instance metadata %s: %w", metadata.ID, err)
	}
	if !durableState(metadata.State) {
		return nil
	}
	if err := atomicfile.Commit(target); err != nil {
		return fmt.Errorf("commit instance metadata %s: %w", metadata.ID, err)
	}
	return nil
}

func durableState(runtimeState types.RuntimeState) bool {
	switch runtimeState {
	case types.RuntimeStateStarted,
		types.RuntimeStateStopped,
		types.RuntimeStateStandby,
		types.RuntimeStatePaused,
		types.RuntimeStateError:
		return true
	default:
		return false
	}
}

func ValidateInstanceID(id string) error {
	if id == "" || id == "." || id == ".." || len(id) > 128 || filepath.Base(id) != id || strings.ContainsRune(id, 0) {
		return fmt.Errorf("invalid instance id %q", id)
	}
	return nil
}

type InstanceListing struct {
	Instances  []InstanceMetadata
	Unreadable map[string]error
}

func ListInstances(paths layout.Paths) (InstanceListing, error) {
	listing := InstanceListing{Unreadable: make(map[string]error)}
	entries, err := os.ReadDir(paths.InstancesDir())
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return listing, nil
		}
		return listing, fmt.Errorf("list instance metadata: %w", err)
	}
	listing.Instances = make([]InstanceMetadata, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		metadata, err := ReadInstanceMetadata(paths, entry.Name())
		switch {
		case err == nil:
			listing.Instances = append(listing.Instances, metadata)
		case !errors.Is(err, os.ErrNotExist):
			listing.Unreadable[entry.Name()] = err
		}
	}
	return listing, nil
}

func ListInstanceMetadata(paths layout.Paths) ([]InstanceMetadata, error) {
	listing, err := ListInstances(paths)
	if err != nil {
		return nil, err
	}
	unreadable := make([]error, 0, len(listing.Unreadable))
	for id, readErr := range listing.Unreadable {
		unreadable = append(unreadable, fmt.Errorf("list instance metadata %s: %w", id, readErr))
	}
	if err := errors.Join(unreadable...); err != nil {
		return nil, err
	}
	return listing.Instances, nil
}

func cloneStringMap(values map[string]string) map[string]string {
	if len(values) == 0 {
		return nil
	}
	cloned := make(map[string]string, len(values))
	for key, value := range values {
		cloned[key] = value
	}
	return cloned
}

type RunningMeter struct {
	Millis     uint64     `json:"millis"`
	Since      *time.Time `json:"since,omitempty"`
	ObservedAt *time.Time `json:"observedAt,omitempty"`
}
