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

package control

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/snapflowio/microvm-go/guest"
)

const (
	Port                       = 2223
	ProtocolVersion            = 1
	SessionPath                = "/v1/session"
	ReadyPath                  = "/v1/ready"
	WorkloadReadyPath          = "/v1/workload/ready"
	RestorePath                = "/v1/restore"
	ForkPreparePath            = "/v1/fork/prepare"
	ForkResumePath             = "/v1/fork/resume"
	SecretsApplyPath           = "/v1/secrets/apply"
	HealthExecPath             = "/v1/health/exec"
	TelemetryPath              = "/v1/telemetry"
	HostsApplyPath             = "/v1/hosts/apply"
	VolumesFreezePath          = "/v1/volumes/freeze"
	VolumesThawPath            = "/v1/volumes/thaw"
	WorkloadSecretsPath        = "/run/microvm-go/workload-secrets.json"
	WorkloadSecretsAppliedPath = "/run/microvm-go/workload-secrets.applied"
	WorkloadInitPath           = "/run/microvm-go/workload-init.json"
	WorkloadGatePath           = "/run/microvm-go/workload-init.ready"
	WorkloadAppliedPath        = "/run/microvm-go/workload-init.applied"
	WorkloadStartedPath        = "/run/microvm-go/workload-started"
)

const (
	GuestSessionHeader             = "X-Snapflow-Guest-Session"
	GuestHostSessionHeader         = "X-Snapflow-Host-Session"
	GuestSessionSignatureAlgorithm = "ed25519"
	GuestSessionSignatureDomain    = "snapflow.guest.session.v1"
)

func ProtocolFeatures() []string {
	return []string{
		"typed-problems-v1",
		"digest-receipts-v1",
		"identity-bound-session-v1",
		"managed-hosts-v1",
	}
}

type HostEntry struct {
	Address string   `json:"address"`
	Aliases []string `json:"aliases"`
}

type ApplyHostsRequest struct {
	Entries []HostEntry `json:"entries"`
}

// MaxFrozenVolumes matches the most volumes an instance can attach.
const MaxFrozenVolumes = 16

type FreezeVolumesRequest struct {
	MountPaths []string `json:"mountPaths"`
}

func (r FreezeVolumesRequest) Validate() error {
	if len(r.MountPaths) == 0 || len(r.MountPaths) > MaxFrozenVolumes {
		return fmt.Errorf("volume freeze requires between one and %d mount paths", MaxFrozenVolumes)
	}
	seen := make(map[string]struct{}, len(r.MountPaths))
	for _, path := range r.MountPaths {
		if !filepath.IsAbs(path) || filepath.Clean(path) != path || path == string(filepath.Separator) {
			return fmt.Errorf("volume mount path %q must be a clean absolute non-root path", path)
		}
		if _, exists := seen[path]; exists {
			return fmt.Errorf("volume mount path %q is duplicated", path)
		}
		seen[path] = struct{}{}
	}
	return nil
}

type SessionRequest struct {
	MinimumProtocolVersion int      `json:"minimumProtocolVersion"`
	MaximumProtocolVersion int      `json:"maximumProtocolVersion"`
	Features               []string `json:"features"`
	HostSessionID          string   `json:"hostSessionId"`
}

type SessionIdentity struct {
	ProtocolVersion int      `json:"protocolVersion"`
	Features        []string `json:"features"`
	BuildDigest     string   `json:"buildDigest"`
	BootID          string   `json:"bootId"`
	InstanceID      string   `json:"instanceId"`
	GenerationID    string   `json:"generationId"`
	HostSessionID   string   `json:"hostSessionId"`
	GuestSessionID  string   `json:"guestSessionId"`
	GuestPublicKey  string   `json:"guestPublicKey"`
	GuestKeyID      string   `json:"guestKeyId"`
	ExpiresAt       string   `json:"expiresAt"`
}

type SessionResponse struct {
	SessionIdentity
	Algorithm string `json:"algorithm"`
	Signature string `json:"signature"`
}

type Problem struct {
	Code      string                       `json:"code"`
	Message   string                       `json:"message"`
	Retryable bool                         `json:"retryable"`
	Details   *guest.ControlProblemDetails `json:"details,omitempty"`
}

const (
	maxSecretEnvironmentEntries      = 256
	maxSecretEnvironmentBytes        = 1 << 20
	maxJSONEscapedByteFactor         = 6
	maxSecretEnvironmentPayloadBytes = (maxSecretEnvironmentBytes+maxSecretEnvironmentEntries*128)*maxJSONEscapedByteFactor + 1024
	maxWorkloadArguments             = 256
	maxWorkloadArgumentBytes         = 16 * 1024
)

var environmentNamePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]{0,127}$`)

const (
	ControlTokenHeader = "X-MicroVM-Control-Token"
)

type RestoredIdentity struct {
	InstanceID         string            `json:"instanceId"`
	GenerationID       string            `json:"generationId"`
	GuestServiceTokens map[string]string `json:"guestServiceTokens,omitempty"`
	ControlAuthToken   string            `json:"controlAuthToken"`
	Hostname           string            `json:"hostname"`
	MachineID          string            `json:"machineId"`
	HostUnixNano       int64             `json:"hostUnixNano"`
	RandomSeed         []byte            `json:"randomSeed"`
}

const RandomSeedBytes = 64

type RestoreRequest struct {
	Identity RestoredIdentity           `json:"identity"`
	Workload *InitializeWorkloadRequest `json:"workload,omitempty"`
	Session  SessionRequest             `json:"session"`
}

type RestoreResponse struct {
	Session SessionResponse `json:"session"`
}

const (
	RestoreStepRequest  = "request"
	RestoreStepIdentity = "identity"
	RestoreStepResume   = "resume"
	RestoreStepWorkload = "workload"
	RestoreStepSession  = "session"
)

type Response struct {
	Status                string `json:"status"`
	AcceptedRequestDigest string `json:"acceptedRequestDigest"`
}

type ApplySecretsRequest struct {
	Values map[string]string `json:"values"`
}

type InitializeWorkloadRequest struct {
	InstanceID   string            `json:"instanceId"`
	GenerationID string            `json:"generationId"`
	OSUser       string            `json:"osUser"`
	Env          map[string]string `json:"env,omitempty"`
	SecretEnv    map[string]string `json:"secretEnv,omitempty"`
	Entrypoint   []string          `json:"entrypoint,omitempty"`
}

type ExecHealthRequest struct {
	Command    string `json:"command"`
	WorkingDir string `json:"workingDir,omitempty"`
}

type ExecHealthResponse struct {
	ExitCode int    `json:"exitCode"`
	Output   string `json:"output,omitempty"`
}

type TelemetrySnapshot struct {
	BootID                string   `json:"bootId"`
	CPUTotalTicks         uint64   `json:"cpuTotalTicks"`
	CPUBusyTicks          uint64   `json:"cpuBusyTicks"`
	MemoryTotalBytes      uint64   `json:"memoryTotalBytes"`
	MemoryUsedBytes       uint64   `json:"memoryUsedBytes"`
	StorageTotalBytes     uint64   `json:"storageTotalBytes"`
	StorageUsedBytes      uint64   `json:"storageUsedBytes"`
	NetworkReceiveBytes   uint64   `json:"networkReceiveBytes"`
	NetworkTransmitBytes  uint64   `json:"networkTransmitBytes"`
	GPUUtilizationPercent *float64 `json:"gpuUtilizationPercent,omitempty"`
	GPUMemoryUsedBytes    *uint64  `json:"gpuMemoryUsedBytes,omitempty"`
	GPUMemoryTotalBytes   *uint64  `json:"gpuMemoryTotalBytes,omitempty"`
}

func (r ApplySecretsRequest) Validate() error {
	if len(r.Values) == 0 {
		return fmt.Errorf("at least one secret environment value is required")
	}
	if len(r.Values) > maxSecretEnvironmentEntries {
		return fmt.Errorf("secret environment exceeds %d entries", maxSecretEnvironmentEntries)
	}
	total := 0
	for name, value := range r.Values {
		if !environmentNamePattern.MatchString(name) {
			return fmt.Errorf("secret environment contains an invalid variable name")
		}
		total += len(name) + len(value)
		if total > maxSecretEnvironmentBytes {
			return fmt.Errorf("secret environment exceeds %d bytes", maxSecretEnvironmentBytes)
		}
	}
	return nil
}

func (r InitializeWorkloadRequest) Validate() error {
	if strings.TrimSpace(r.InstanceID) == "" || strings.TrimSpace(r.GenerationID) == "" {
		return fmt.Errorf("workload instance and generation identities are required")
	}
	if strings.TrimSpace(r.OSUser) == "" {
		return fmt.Errorf("workload OS user is required")
	}
	if err := validateEnvironment(r.Env, false); err != nil {
		return fmt.Errorf("validate workload environment: %w", err)
	}
	if err := validateEnvironment(r.SecretEnv, false); err != nil {
		return fmt.Errorf("validate workload secret environment: %w", err)
	}
	if len(r.Entrypoint) > maxWorkloadArguments {
		return fmt.Errorf("workload entrypoint exceeds %d arguments", maxWorkloadArguments)
	}
	for _, argument := range r.Entrypoint {
		if len(argument) > maxWorkloadArgumentBytes {
			return fmt.Errorf("workload entrypoint argument exceeds %d bytes", maxWorkloadArgumentBytes)
		}
	}
	return nil
}

func validateEnvironment(values map[string]string, requireValues bool) error {
	if requireValues && len(values) == 0 {
		return fmt.Errorf("at least one environment value is required")
	}
	if len(values) > maxSecretEnvironmentEntries {
		return fmt.Errorf("environment exceeds %d entries", maxSecretEnvironmentEntries)
	}
	total := 0
	for name, value := range values {
		if !environmentNamePattern.MatchString(name) {
			return fmt.Errorf("environment contains an invalid variable name")
		}
		total += len(name) + len(value)
		if total > maxSecretEnvironmentBytes {
			return fmt.Errorf("environment exceeds %d bytes", maxSecretEnvironmentBytes)
		}
	}
	return nil
}

type SessionResetter interface {
	ResetSessions() error
}

type NopSessionResetter struct{}

func (NopSessionResetter) ResetSessions() error { return nil }
