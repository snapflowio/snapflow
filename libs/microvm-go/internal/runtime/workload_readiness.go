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
	"fmt"
	"time"

	"github.com/snapflowio/microvm-go/internal/guestcontrol"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
)

const workloadReadinessTimeout = 30 * time.Second

func (b *Backend) waitForWorkloadReady(ctx context.Context, metadata state.InstanceMetadata) error {
	client, err := guestcontrol.NewClient(metadata.VsockSocket, metadata.ControlAuthToken)
	if err != nil {
		return fmt.Errorf("create workload readiness client: %w", err)
	}
	defer client.Close()
	return b.waitForWorkloadReadyWithClient(ctx, metadata, client)
}

func (b *Backend) waitForWorkloadReadyWithClient(ctx context.Context, metadata state.InstanceMetadata, client workloadControl) error {
	return runLifecycleAction(b, metadata.ID, lifecycle.OperationWorkloadReady, func() error {
		return b.waitForWorkloadReadyPhase(ctx, metadata, client)
	})
}

func (b *Backend) waitForWorkloadReadyPhase(ctx context.Context, metadata state.InstanceMetadata, client workloadControl) error {
	if metadata.TemplateSeed {
		return nil
	}
	readinessCtx, cancel := context.WithTimeout(ctx, workloadReadinessTimeout)
	defer cancel()

	if err := retryGuestOperation(
		readinessCtx,
		func() error { return client.WorkloadReady(readinessCtx) },
		retryEveryError,
	); err != nil {
		return fmt.Errorf("wait for workload readiness: %w", err)
	}
	return nil
}
