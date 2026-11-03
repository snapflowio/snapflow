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
	"net/http"

	"github.com/snapflowio/microvm-go/hypervisor"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/guestcontrol"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
)

const (
	vmmLaunchPhase       = "vmm_launch_ms"
	guestReadyPhase      = "guest_ready_ms"
	guestServicesPhase   = "guest_services_ms"
	secretInjectionPhase = "secret_injection_ms"
	workloadReadyPhase   = "workload_ready_ms"
)

func (b *Backend) bootInstance(
	ctx context.Context,
	transaction *lifecycle.Transaction,
	metadata *state.InstanceMetadata,
	assets bootAssets,
	secretEnv map[string]string,
	timer *phaseTimer,
) error {
	var process hypervisor.Process
	if err := timer.time(vmmLaunchPhase, func() error {
		var startErr error
		process, startErr = b.startVMWithAssets(ctx, *metadata, assets)
		return startErr
	}); err != nil {
		return err
	}
	if err := transaction.Defer("instance VMM process", func(context.Context) error {
		return b.terminateVMM(*metadata, process)
	}); err != nil {
		return err
	}
	guestClient, err := guestcontrol.NewClient(metadata.VsockSocket, metadata.ControlAuthToken)
	if err != nil {
		return fmt.Errorf("create guest lifecycle client: %w", err)
	}
	defer guestClient.Close()
	if err := timer.time(guestReadyPhase, func() error {
		return b.waitForGuestReadyWithClient(ctx, *metadata, guestClient)
	}); err != nil {
		return err
	}
	if err := timer.time(guestServicesPhase, func() error {
		return b.waitForGuestServicesReady(ctx, *metadata)
	}); err != nil {
		return err
	}
	if err := timer.time(secretInjectionPhase, func() error {
		return b.injectRuntimeSecretsWithClient(ctx, *metadata, secretEnv, guestClient)
	}); err != nil {
		return err
	}
	if err := timer.time(workloadReadyPhase, func() error {
		return b.waitForWorkloadReadyWithClient(ctx, *metadata, guestClient)
	}); err != nil {
		return mvmerrors.NewWithCause(
			http.StatusUnprocessableEntity,
			"the workload did not become ready",
			"MICROVM_WORKLOAD_START_FAILED",
			err,
		)
	}
	return b.commitStarted(metadata, process)
}
