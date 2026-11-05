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

package types

import (
	"time"

	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/healthcheck"
	"github.com/snapflowio/microvm-go/restartpolicy"
)

type Registry struct {
	URL      string  `json:"url" validate:"required"`
	Project  *string `json:"project" validate:"optional"`
	Username string  `json:"username" validate:"required"`
	Password string  `json:"password" validate:"required"`
}

type (
	ImagePullPolicy string
	InitialState    string
)

const (
	ImagePullIfNotPresent ImagePullPolicy = "IfNotPresent"
	ImagePullAlways       ImagePullPolicy = "Always"
	ImagePullNever        ImagePullPolicy = "Never"

	InitialStateRunning InitialState = "running"
	InitialStateStopped InitialState = "stopped"
)

type RuntimeArtifactIdentity struct {
	InstanceID              string `json:"instanceId" validate:"required,uuid"`
	AssignmentGeneration    int    `json:"assignmentGeneration" validate:"min=1"`
	LifecycleGeneration     int    `json:"lifecycleGeneration" validate:"min=1"`
	SpecificationGeneration int    `json:"specificationGeneration" validate:"min=0"`
	IntentDigest            string `json:"intentDigest" validate:"required"`
}

type CreateRequest struct {
	Identity           RuntimeArtifactIdentity   `json:"identity"`
	ID                 string                    `json:"id" validate:"required,uuid"`
	UserID             string                    `json:"userId" validate:"required"`
	Image              string                    `json:"image" validate:"required"`
	ImagePullPolicy    ImagePullPolicy           `json:"imagePullPolicy,omitempty"`
	InitialState       InitialState              `json:"initialState,omitempty"`
	Platform           string                    `json:"platform,omitempty"`
	Hypervisor         string                    `json:"hypervisor,omitempty"`
	OSUser             string                    `json:"osUser" validate:"required"`
	CPUQuota           int64                     `json:"cpuQuota" validate:"min=1"`
	GPUQuota           int64                     `json:"gpuQuota" validate:"min=0"`
	GPUType            string                    `json:"gpuType,omitempty"`
	MemoryQuota        int64                     `json:"memoryQuota" validate:"min=1"`
	StorageQuota       int64                     `json:"storageQuota" validate:"min=1"`
	Env                map[string]string         `json:"env,omitempty"`
	SecretEnv          map[string]string         `json:"secretEnv,omitempty"`
	Labels             map[string]string         `json:"labels,omitempty"`
	NetworkBlockAll    *bool                     `json:"networkBlockAll,omitempty"`
	NetworkAllowList   *string                   `json:"networkAllowList,omitempty"`
	DomainAllowList    *string                   `json:"domainAllowList,omitempty"`
	EgressBandwidthBPS *uint64                   `json:"egressBandwidthBps,omitempty"`
	NetworkName        string                    `json:"networkName,omitempty"`
	LinkedPeerID       string                    `json:"linkedPeerId,omitempty" validate:"omitempty,uuid"`
	Registry           *Registry                 `json:"registry,omitempty"`
	Entrypoint         []string                  `json:"entrypoint,omitempty"`
	ManagedWorkload    bool                      `json:"managedWorkload,omitempty"`
	Volumes            []VolumeAttachment        `json:"volumes,omitempty"`
	HealthCheck        *healthcheck.Policy       `json:"healthCheck,omitempty"`
	RestartPolicy      *restartpolicy.Policy     `json:"restartPolicy,omitempty"`
	Capabilities       []guest.SandboxCapability `json:"capabilities"`
	DirectIO           bool                      `json:"directIo,omitempty"`
}

func PersistentCreateRequest(request CreateRequest) CreateRequest {
	request.SecretEnv = nil
	request.Registry = nil
	if len(request.Volumes) == 0 {
		return request
	}
	request.Volumes = append([]VolumeAttachment(nil), request.Volumes...)
	for index := range request.Volumes {
		request.Volumes[index].Restore = nil
	}
	return request
}

type WorkloadInitialization struct {
	InstanceID   string            `json:"instanceId"`
	GenerationID string            `json:"generationId"`
	OSUser       string            `json:"osUser"`
	Env          map[string]string `json:"env,omitempty"`
	SecretEnv    map[string]string `json:"secretEnv,omitempty"`
	Entrypoint   []string          `json:"entrypoint,omitempty"`
}

type ResizeRequest struct {
	CPU                  *int64 `json:"cpu,omitempty" validate:"omitempty,min=1"`
	GPU                  *int64 `json:"gpu,omitempty" validate:"omitempty,min=0"`
	Memory               *int64 `json:"memory,omitempty" validate:"omitempty,min=1"`
	Storage              *int64 `json:"storage,omitempty" validate:"omitempty,min=1"`
	AssignmentGeneration int    `json:"assignmentGeneration,omitempty" validate:"min=0"`
}

type StartOptions struct {
	SecretEnv            map[string]string       `json:"secretEnv,omitempty"`
	Initialization       *WorkloadInitialization `json:"initialization,omitempty"`
	AssignmentGeneration int                     `json:"assignmentGeneration,omitempty" validate:"min=0"`
}

type StopOptions struct {
	Force                bool          `json:"force,omitempty"`
	GracePeriod          time.Duration `json:"gracePeriod,omitempty"`
	AssignmentGeneration int           `json:"assignmentGeneration,omitempty" validate:"min=0"`
}

type ExportImageSource string

const (
	ExportImageSourceStopped  ExportImageSource = "stopped"
	ExportImageSourceQuiesced ExportImageSource = "quiesced"
)

type ExportImageRequest struct {
	Source     ExportImageSource `json:"source,omitempty"`
	Reference  string            `json:"reference,omitempty"`
	Repository string            `json:"repository,omitempty"`
	NamePrefix string            `json:"namePrefix,omitempty"`
	Tag        string            `json:"tag,omitempty"`
	Registry   *Registry         `json:"registry" validate:"required"`
}

type ForkRequest struct {
	ID                   string            `json:"id" validate:"required,uuid"`
	Start                bool              `json:"start,omitempty"`
	SecretEnv            map[string]string `json:"secretEnv,omitempty"`
	AssignmentGeneration int               `json:"assignmentGeneration" validate:"min=1"`
}

type NetworkSettings struct {
	NetworkBlockAll    *bool   `json:"networkBlockAll,omitempty"`
	NetworkAllowList   *string `json:"networkAllowList,omitempty"`
	DomainAllowList    *string `json:"domainAllowList,omitempty"`
	EgressBandwidthBPS *uint64 `json:"egressBandwidthBps,omitempty"`
}

type RuntimeInfo struct {
	State              RuntimeState          `json:"state"`
	CPUVCPUs           int64                 `json:"cpuVcpus"`
	MemoryGiB          int64                 `json:"memoryGiB"`
	StorageGiB         int64                 `json:"storageGiB"`
	HealthCheck        *healthcheck.Policy   `json:"healthCheck,omitempty"`
	HealthCheckRuntime *healthcheck.Runtime  `json:"healthCheckRuntime,omitempty"`
	RestartPolicy      *restartpolicy.Policy `json:"restartPolicy,omitempty"`
	RestartStatus      restartpolicy.Status  `json:"restartStatus"`
	ExitCode           *int                  `json:"exitCode,omitempty"`
	ExitMessage        string                `json:"exitMessage,omitempty"`
}

type PreparedPlatformBundle struct {
	Name         string                    `json:"name"`
	Reference    string                    `json:"reference"`
	Digest       string                    `json:"digest"`
	Platform     string                    `json:"platform"`
	SizeBytes    int64                     `json:"sizeBytes"`
	Capabilities []guest.SandboxCapability `json:"capabilities"`
}

type BuildRequest struct {
	Image                  string                `json:"image,omitempty"`
	LogReference           string                `json:"logReference,omitempty"`
	BuildLogUploadURL      string                `json:"buildLogUploadUrl,omitempty"`
	Registry               *Registry             `json:"registry,omitempty"`
	SourceRegistries       []Registry            `json:"sourceRegistries,omitempty"`
	Dockerfile             string                `json:"dockerfile" validate:"required"`
	Contexts               []BuildContextArchive `json:"contexts,omitempty"`
	PushToInternalRegistry bool                  `json:"pushToInternalRegistry"`
	CacheRegistry          *Registry             `json:"cacheRegistry" validate:"required"`
	Tenant                 string                `json:"tenant" validate:"required"`
}

type BuildContextArchive struct {
	Hash        string `json:"hash" validate:"required"`
	DownloadURL string `json:"downloadUrl" validate:"required,url"`
}
