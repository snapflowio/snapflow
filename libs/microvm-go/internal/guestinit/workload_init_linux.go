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

//go:build linux

package guestinit

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"

	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/filewait"
	"github.com/snapflowio/microvm-go/internal/guest/control"
)

type pendingWorkloadInitialization struct {
	request control.InitializeWorkloadRequest
	digest  [sha256.Size]byte
}

func waitForWorkloadInitialization(ctx context.Context) (pendingWorkloadInitialization, error) {
	if err := os.MkdirAll("/run/microvm-go", filemode.PrivateDirectory); err != nil {
		return pendingWorkloadInitialization{}, fmt.Errorf("create workload initialization directory: %w", err)
	}
	if err := os.WriteFile(control.WorkloadGatePath, nil, filemode.PrivateFile); err != nil {
		return pendingWorkloadInitialization{}, fmt.Errorf("publish workload initialization gate: %w", err)
	}
	request := control.InitializeWorkloadRequest{}
	data, err := filewait.Read(ctx, control.WorkloadInitPath, func(data []byte) error {
		if err := json.Unmarshal(data, &request); err != nil {
			return fmt.Errorf("decode workload initialization: %w", err)
		}
		if err := request.Validate(); err != nil {
			return fmt.Errorf("validate workload initialization: %w", err)
		}
		return nil
	})
	if err != nil {
		return pendingWorkloadInitialization{}, err
	}
	return pendingWorkloadInitialization{
		request: request,
		digest:  sha256.Sum256(data),
	}, nil
}

func acknowledgeWorkloadInitialization(digest [sha256.Size]byte) error {
	if err := os.Remove(control.WorkloadInitPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove consumed workload initialization: %w", err)
	}
	if err := atomicfile.Replace(control.WorkloadAppliedPath, digest[:], filemode.PrivateFile); err != nil {
		return fmt.Errorf("acknowledge workload initialization: %w", err)
	}
	if err := atomicfile.Commit(control.WorkloadAppliedPath); err != nil {
		return fmt.Errorf("acknowledge workload initialization: %w", err)
	}
	return nil
}

func acknowledgeWorkloadStarted(cfg *Config) error {
	if cfg == nil {
		return fmt.Errorf("workload configuration is required")
	}
	if cfg.GuestInit.GenerationID == "" {
		return fmt.Errorf("workload generation identity is required")
	}
	if err := atomicfile.Replace(control.WorkloadStartedPath, []byte(cfg.GuestInit.GenerationID), filemode.PrivateFile); err != nil {
		return fmt.Errorf("acknowledge workload start: %w", err)
	}
	if err := atomicfile.Commit(control.WorkloadStartedPath); err != nil {
		return fmt.Errorf("acknowledge workload start: %w", err)
	}
	return nil
}

func mergeEnvironment(base, overrides map[string]string) map[string]string {
	result := make(map[string]string, len(base)+len(overrides))
	for name, value := range base {
		result[name] = value
	}
	for name, value := range overrides {
		result[name] = value
	}
	return result
}
