// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package qualification

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"
)

const (
	schemaVersion          = 2
	policyVersion          = 2
	expectedAudience       = "snapflow-control-plane"
	maximumDurationSeconds = 120
	maximumDiskSampleBytes = 8 * 1024 * 1024
	maximumCPUIterations   = 100_000
	maximumClockSkew       = 30 * time.Second
	checkRuntimeHealth     = "runtime_health"
	checkStorageIO         = "storage_io"
	checkCPUBoundedWork    = "cpu_bounded_work"
	checkMachineIdentity   = "machine_identity"
	checkCanaryMicroVM     = "canary_microvm"
)

func requiredChecks() []string {
	return []string{
		checkRuntimeHealth,
		checkStorageIO,
		checkCPUBoundedWork,
		checkMachineIdentity,
		checkCanaryMicroVM,
	}
}

type WorkLimits struct {
	MaximumDurationSeconds int   `json:"maximumDurationSeconds"`
	DiskSampleBytes        int64 `json:"diskSampleBytes"`
	CPUIterations          int   `json:"cpuIterations"`
}

type Canary struct {
	Snapshot   string `json:"snapshot"`
	CPU        int32  `json:"cpu"`
	MemoryGiB  int32  `json:"memoryGiB"`
	StorageGiB int32  `json:"storageGiB"`
}

type Request struct {
	SchemaVersion     int        `json:"schemaVersion"`
	PolicyVersion     int        `json:"policyVersion"`
	Audience          string     `json:"audience"`
	ChallengeID       string     `json:"challengeId"`
	MachineID         string     `json:"machineId"`
	SessionID         string     `json:"sessionId"`
	SessionGeneration int        `json:"sessionGeneration"`
	MachineKeyID      string     `json:"machineKeyId"`
	Nonce             string     `json:"nonce"`
	InputFingerprint  string     `json:"inputFingerprint"`
	IssuedAt          string     `json:"issuedAt"`
	ExpiresAt         string     `json:"expiresAt"`
	RequestedCheckIDs []string   `json:"requestedCheckIds"`
	WorkLimits        WorkLimits `json:"workLimits"`
	Canary            Canary     `json:"canary"`
}

func decodeRequest(payload string) (Request, error) {
	decoder := json.NewDecoder(strings.NewReader(payload))
	decoder.DisallowUnknownFields()
	var request Request
	if err := decoder.Decode(&request); err != nil {
		return Request{}, fmt.Errorf("decode machine qualification request: %w", err)
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return Request{}, errors.New("machine qualification request contains trailing JSON")
	}
	return request, nil
}
