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

const guestReadinessTimeout = 30 * time.Second

func (b *Backend) waitForGuestReady(ctx context.Context, metadata state.InstanceMetadata) error {
	client, err := guestcontrol.NewClient(metadata.VsockSocket, metadata.ControlAuthToken)
	if err != nil {
		return fmt.Errorf("create instance readiness client: %w", err)
	}
	defer client.Close()
	return b.waitForGuestReadyWithClient(ctx, metadata, client)
}

func (b *Backend) waitForGuestReadyWithClient(ctx context.Context, metadata state.InstanceMetadata, client *guestcontrol.Client) error {
	return runLifecycleAction(b, metadata.ID, lifecycle.OperationGuestHandshake, func() error {
		return b.waitForGuestReadyPhase(ctx, metadata, client)
	})
}

func (b *Backend) waitForGuestReadyPhase(ctx context.Context, metadata state.InstanceMetadata, client *guestcontrol.Client) error {
	readinessCtx, cancel := context.WithTimeout(ctx, guestReadinessTimeout)
	defer cancel()

	if err := retryGuestOperation(
		readinessCtx,
		func() error { return client.Ready(readinessCtx) },
		retryEveryError,
	); err != nil {
		return fmt.Errorf("wait for instance guest readiness: %w%s", err, b.guestConsoleExcerpt(metadata.ID))
	}
	session, err := client.Session(readinessCtx)
	if err != nil {
		return fmt.Errorf("read negotiated guest identity: %w", err)
	}
	if session.InstanceID != metadata.ID ||
		session.InstanceID != metadata.Identity.InstanceID ||
		session.GenerationID != metadata.GenerationID {
		return fmt.Errorf("negotiated guest identity does not match runtime metadata")
	}
	observedAt := time.Now().UTC()
	metadata.GuestProtocolVersion = session.ProtocolVersion
	metadata.GuestBuildDigest = session.BuildDigest
	metadata.GuestBootID = session.BootID
	metadata.GuestKeyID = session.GuestKeyID
	metadata.GuestObservedAt = &observedAt
	if err := state.WriteInstanceMetadata(b.paths, metadata); err != nil {
		return fmt.Errorf("persist negotiated guest identity: %w", err)
	}
	return nil
}
