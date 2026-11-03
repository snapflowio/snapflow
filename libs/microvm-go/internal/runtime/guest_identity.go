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
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"net"
	"os"
	"strings"
	"time"

	"github.com/snapflowio/microvm-go/internal/guest/control"
	"github.com/snapflowio/microvm-go/internal/guestcontrol"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/vsock"
	"github.com/snapflowio/microvm-go/types"
)

const hostnameIDLength = 12

func (b *Backend) prepareGuestForSnapshot(ctx context.Context, metadata state.InstanceMetadata) error {
	client, err := guestcontrol.NewClient(metadata.VsockSocket, metadata.ControlAuthToken)
	if err != nil {
		return err
	}
	defer client.Close()
	if err := client.PrepareFork(ctx); err != nil {
		return fmt.Errorf("quiesce instance identity before snapshot: %w", err)
	}
	return nil
}

func (b *Backend) resumeGuestAfterSnapshot(ctx context.Context, metadata state.InstanceMetadata) error {
	client, err := guestcontrol.NewClient(metadata.VsockSocket, metadata.ControlAuthToken)
	if err != nil {
		return err
	}
	defer client.Close()
	if err := retryVsockHandshake(ctx, client.ResumeAfterFork); err != nil {
		return fmt.Errorf("resume instance identity after snapshot: %w", err)
	}
	return nil
}

func (b *Backend) quiesceGuestForSnapshot(ctx context.Context, metadata *state.InstanceMetadata) error {
	if metadata == nil {
		return fmt.Errorf("instance metadata is required")
	}
	if err := b.prepareGuestForSnapshot(ctx, *metadata); err != nil {
		return err
	}
	metadata.SnapshotIdentityQuiesced = true
	metadata.SnapshotControlAuthToken = metadata.ControlAuthToken
	if err := state.WriteInstanceMetadata(b.paths, *metadata); err != nil {
		resumeErr := b.resumeGuestAfterSnapshot(context.WithoutCancel(ctx), *metadata)
		metadata.SnapshotIdentityQuiesced = false
		metadata.SnapshotControlAuthToken = ""
		return errors.Join(
			fmt.Errorf("persist quiesced instance identity: %w", err),
			wrapOptionalError("resume instance identity after persistence failure", resumeErr),
		)
	}
	return nil
}

func (b *Backend) persistSnapshotPause(metadata *state.InstanceMetadata) error {
	if metadata == nil {
		return fmt.Errorf("instance metadata is required")
	}
	if err := b.persistRuntimeState(metadata, types.RuntimeStatePaused); err != nil {
		return fmt.Errorf("persist instance snapshot pause: %w", err)
	}
	return nil
}

func (b *Backend) resumeSnapshotSource(ctx context.Context, metadata *state.InstanceMetadata) error {
	if metadata == nil {
		return fmt.Errorf("instance metadata is required")
	}
	paused, err := b.vmIsPaused(ctx, *metadata)
	if err != nil {
		return fmt.Errorf("inspect snapshot source VM state: %w", err)
	}
	if paused {
		err = b.resumeVM(ctx, *metadata)
	}
	if err != nil {
		return fmt.Errorf("resume snapshot source VM: %w", err)
	}
	if err := b.resumeGuestAfterSnapshot(ctx, *metadata); err != nil {
		return err
	}
	metadata.SnapshotIdentityQuiesced = false
	metadata.SnapshotControlAuthToken = ""
	if err := b.persistRuntimeState(metadata, types.RuntimeStateStarted); err != nil {
		return fmt.Errorf("persist resumed snapshot source: %w", err)
	}
	return nil
}

func (b *Backend) recoverQuiescedSnapshotSource(ctx context.Context, metadata *state.InstanceMetadata) error {
	if metadata == nil {
		return fmt.Errorf("instance metadata is required")
	}
	paused, err := b.vmIsPaused(ctx, *metadata)
	if err != nil {
		return fmt.Errorf("inspect quiesced snapshot source: %w", err)
	}
	if paused {
		return b.resumeSnapshotSource(ctx, metadata)
	}
	if err := b.resumeGuestAfterSnapshot(ctx, *metadata); err != nil {
		return err
	}
	metadata.SnapshotIdentityQuiesced = false
	metadata.SnapshotControlAuthToken = ""
	if err := b.persistRuntimeState(metadata, types.RuntimeStateStarted); err != nil {
		return fmt.Errorf("persist recovered snapshot source: %w", err)
	}
	return nil
}

func (b *Backend) restoreGuest(ctx context.Context, metadata *state.InstanceMetadata, initialization *types.WorkloadInitialization) (*guestcontrol.Client, error) {
	if metadata == nil {
		return nil, fmt.Errorf("instance metadata is required")
	}
	authToken := metadata.RestoreControlAuthToken
	if authToken == "" {
		authToken = metadata.ControlAuthToken
	}
	client, err := guestcontrol.NewClient(metadata.VsockSocket, authToken)
	if err != nil {
		return nil, err
	}
	defer client.Close()
	randomSeed := make([]byte, control.RandomSeedBytes)
	if _, err := rand.Read(randomSeed); err != nil {
		return nil, fmt.Errorf("generate guest random seed: %w", err)
	}
	identity := control.RestoredIdentity{
		InstanceID:         metadata.ID,
		GenerationID:       metadata.GenerationID,
		GuestServiceTokens: metadata.GuestServiceTokens,
		ControlAuthToken:   metadata.ControlAuthToken,
		Hostname:           instanceHostname(metadata.ID),
		MachineID:          instanceMachineID(metadata.ID),
		HostUnixNano:       time.Now().UnixNano(),
		RandomSeed:         randomSeed,
	}
	workload, err := restoredWorkloadRequest(*metadata, initialization)
	if err != nil {
		return nil, err
	}
	var restored *guestcontrol.Client
	if err := runLifecycleAction(b, metadata.ID, lifecycle.OperationGuestRestore, func() error {
		return retryVsockHandshake(ctx, func(requestCtx context.Context) error {
			var restoreErr error
			restored, restoreErr = client.Restore(requestCtx, identity, workload)
			return restoreErr
		})
	}); err != nil {
		return nil, fmt.Errorf("restore guest: %w", err)
	}
	session, err := restored.Session(ctx)
	if err != nil {
		restored.Close()
		return nil, fmt.Errorf("read restored guest session: %w", err)
	}
	observedAt := time.Now().UTC()
	metadata.RestoreControlAuthToken = ""
	metadata.WorkloadInitialized = metadata.WorkloadInitialized || workload != nil
	metadata.GuestProtocolVersion = session.ProtocolVersion
	metadata.GuestBuildDigest = session.BuildDigest
	metadata.GuestBootID = session.BootID
	metadata.GuestKeyID = session.GuestKeyID
	metadata.GuestObservedAt = &observedAt
	return restored, nil
}

func retryVsockHandshake(ctx context.Context, operation func(context.Context) error) error {
	retryCtx, cancel := context.WithTimeout(ctx, guestReadinessTimeout)
	defer cancel()
	return retryGuestOperation(
		retryCtx,
		func() error { return operation(retryCtx) },
		retryableVsockHandshakeError,
	)
}

func retryableVsockHandshakeError(err error) bool {
	if errors.Is(err, vsock.ErrHandshakeClosed) ||
		errors.Is(err, vsock.ErrHandshakeTimeout) ||
		errors.Is(err, os.ErrDeadlineExceeded) {
		return true
	}
	var networkError net.Error
	return errors.As(err, &networkError) && networkError.Timeout()
}

func instanceMachineID(id string) string {
	digest := sha256.Sum256([]byte(id))
	return fmt.Sprintf("%x", digest[:16])
}

func instanceHostname(id string) string {
	var normalized strings.Builder
	for _, char := range strings.ToLower(id) {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') {
			normalized.WriteRune(char)
		}
		if normalized.Len() == hostnameIDLength {
			break
		}
	}
	if normalized.Len() == 0 {
		return "snapflow-instance"
	}
	return "snapflow-" + normalized.String()
}
