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
	"slices"
	"time"

	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/internal/guest/control"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/vsock"
	"github.com/snapflowio/microvm-go/types"
)

type workloadControl interface {
	WorkloadReady(ctx context.Context) error
}

type restoredGuestTimings struct {
	servicesReadyAt time.Time
	workloadReadyAt time.Time
}

func restoreWorkloadInitialization(metadata state.InstanceMetadata, startOptions types.StartOptions) (*types.WorkloadInitialization, error) {
	if metadata.TemplateKey == "" || metadata.WorkloadInitialized {
		return nil, nil
	}
	if startOptions.Initialization == nil {
		return nil, errors.New("template restore requires workload initialization")
	}
	return startOptions.Initialization, nil
}

func restoredWorkloadRequest(metadata state.InstanceMetadata, initialization *types.WorkloadInitialization) (*control.InitializeWorkloadRequest, error) {
	if initialization == nil {
		return nil, nil
	}
	if initialization.InstanceID != metadata.ID || initialization.GenerationID != metadata.GenerationID {
		return nil, errors.New("workload initialization identity does not match runtime metadata")
	}
	return &control.InitializeWorkloadRequest{
		InstanceID:   initialization.InstanceID,
		GenerationID: initialization.GenerationID,
		OSUser:       initialization.OSUser,
		Env:          initialization.Env,
		SecretEnv:    initialization.SecretEnv,
		Entrypoint:   initialization.Entrypoint,
	}, nil
}

func restoreReachedWorkload(err error) bool {
	if err == nil {
		return true
	}
	if errors.Is(err, vsock.ErrHandshakeClosed) || errors.Is(err, vsock.ErrHandshakeTimeout) {
		return false
	}
	var problem *guest.ControlProblem
	if errors.As(err, &problem) {
		return problem.Details != nil && slices.Contains([]string{control.RestoreStepWorkload, control.RestoreStepSession}, problem.Details.Step)
	}
	return true
}

func (b *Backend) completeRestoredGuest(ctx context.Context, metadata *state.InstanceMetadata, client workloadControl) (restoredGuestTimings, error) {
	timings := restoredGuestTimings{}
	if err := b.waitForGuestServicesReady(ctx, *metadata); err != nil {
		return timings, err
	}
	timings.servicesReadyAt = time.Now()
	if err := b.waitForWorkloadReadyWithClient(ctx, *metadata, client); err != nil {
		return timings, err
	}
	timings.workloadReadyAt = time.Now()
	return timings, nil
}
