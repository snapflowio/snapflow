// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	desiredStateReadTimeout         = desiredStateWait + 10*time.Second
	minimumDesiredStateReadInterval = time.Second
)

type rejectedDocumentError struct {
	cause error
}

func (failure *rejectedDocumentError) Error() string {
	return fmt.Sprintf("reject machine desired state: %v", failure.cause)
}

func (failure *rejectedDocumentError) Unwrap() error { return failure.cause }

func (manager *Manager) watch(ctx context.Context) error {
	failures := reconnect.DefaultBackoff()
	for {
		startedAt := time.Now()
		previousDigest := manager.observedDigest
		err := manager.refresh(ctx)
		if ctx.Err() != nil {
			return nil
		}
		delay := minimumDesiredStateReadInterval - time.Since(startedAt)
		var rejected *rejectedDocumentError
		switch {
		case err == nil && manager.observedDigest != previousDigest:
			failures.Reset()
			delay = 0
		case err == nil:
			failures.Reset()
		case errors.As(err, &rejected):
			manager.log.WarnContext(ctx, "Rejected machine desired state; keeping the last valid document", "error", err)
		case apierror.IsPermanent(err):
			return err
		default:
			manager.log.WarnContext(ctx, "Machine desired state refresh failed", "error", err)
			delay = failures.Next()
		}
		if !reconnect.Wait(ctx, delay) {
			return nil
		}
	}
}

func (manager *Manager) refresh(ctx context.Context) error {
	readContext, cancel := context.WithTimeout(ctx, desiredStateReadTimeout)
	defer cancel()
	response, changed, err := manager.control.FetchDesiredState(readContext, manager.observedDigest)
	if err != nil {
		return err
	}
	if changed {
		manager.observedDigest = response.Digest
		parsed, err := manager.accept(response.Digest, response.Document, time.Now())
		if err != nil {
			return &rejectedDocumentError{cause: err}
		}
		manager.current.Store(parsed)
		manager.snapshots.Apply(parsed.GetRevision(), parsed.GetSnapshots())
		manager.log.DebugContext(ctx, "Accepted machine desired state", "revision", parsed.GetRevision(), "sandboxes", len(parsed.GetSandboxes()))
	}
	manager.dispatch(ctx)
	return nil
}

func (manager *Manager) accept(digest, encoded string, now time.Time) (*machinev1alpha1.MachineDesiredState, error) {
	parsed := &machinev1alpha1.MachineDesiredState{}
	if err := workload.Decode(encoded, parsed); err != nil {
		return nil, err
	}
	if parsed.GetDigest() != digest {
		return nil, fmt.Errorf("document digest %s was served as %s", parsed.GetDigest(), digest)
	}
	if current := manager.current.Load(); current != nil && parsed.GetRevision() < current.GetRevision() {
		return nil, fmt.Errorf("revision %d would roll back revision %d", parsed.GetRevision(), current.GetRevision())
	}
	if !now.Before(parsed.GetExpiresAt().AsTime()) {
		return nil, fmt.Errorf("document expired at %s", parsed.GetExpiresAt().AsTime())
	}
	return parsed, nil
}

func (manager *Manager) dispatch(ctx context.Context) {
	current := manager.current.Load()
	if current == nil {
		return
	}
	revision, expiresAt := current.GetRevision(), current.GetExpiresAt().AsTime()
	listed := make(map[string]bool, len(current.GetSandboxes()))
	for _, desired := range current.GetSandboxes() {
		listed[desired.GetSandboxId()] = true
		manager.workers.update(work{sandboxID: desired.GetSandboxId(), desired: desired, revision: revision, expiresAt: expiresAt})
	}
	unlisted, err := manager.unlisted(ctx, listed)
	if err != nil {
		manager.log.WarnContext(ctx, "Failed to inspect runtime inventory for unlisted sandboxes", "error", err)
		return
	}
	for _, sandboxID := range unlisted {
		manager.workers.update(work{sandboxID: sandboxID, revision: revision, expiresAt: expiresAt})
	}
}

func (manager *Manager) unlisted(ctx context.Context, listed map[string]bool) ([]string, error) {
	inventory, err := manager.runtime.RuntimeInventory(ctx)
	if err != nil {
		return nil, err
	}
	candidates := make(map[string]bool, len(inventory))
	for index := range inventory {
		if inventory[index].ControlPlaneManaged {
			candidates[inventory[index].ID] = true
		}
	}
	for sandboxID := range manager.records.snapshot() {
		candidates[sandboxID] = true
	}
	unlisted := make([]string, 0, len(candidates))
	for sandboxID := range candidates {
		if !listed[sandboxID] && !manager.local.isHeld(sandboxID) {
			unlisted = append(unlisted, sandboxID)
		}
	}
	return unlisted, nil
}
