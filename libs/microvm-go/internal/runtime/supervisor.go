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
	"fmt"
	"log/slog"
	"os"
	"sync"
	"time"

	"github.com/snapflowio/microvm-go/healthcheck"
	"github.com/snapflowio/microvm-go/internal/exitinfo"
	"github.com/snapflowio/microvm-go/internal/guest/control"
	"github.com/snapflowio/microvm-go/internal/guestcontrol"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/restartpolicy"
	"github.com/snapflowio/microvm-go/types"
)

const (
	supervisionInterval        = 2 * time.Second
	networkMaintenanceInterval = time.Minute
)

func (b *Backend) Run(ctx context.Context) error {
	var inFlight sync.WaitGroup
	defer b.background.Wait()
	defer inFlight.Wait()
	inFlight.Go(func() { b.superviseDiskUsage(ctx) })
	inFlight.Go(func() { b.maintainNetworks(ctx) })
	inFlight.Go(func() { b.templates.VerifyStored(ctx) })
	inFlight.Go(func() { b.builds.Run(ctx) })
	ticker := time.NewTicker(supervisionInterval)
	defer ticker.Stop()
	for {
		b.superviseAll(ctx, &inFlight)
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

func (b *Backend) superviseAll(ctx context.Context, inFlight *sync.WaitGroup) {
	listing, err := state.ListInstances(b.paths)
	if err != nil {
		slog.WarnContext(ctx, "failed to list instances for supervision", "error", err)
		return
	}
	for _, instance := range listing.Instances {
		if !supervisionEligible(instance) || !b.beginSupervision(instance.ID) {
			continue
		}
		inFlight.Go(func() {
			defer b.endSupervision(instance.ID)
			if err := b.superviseInstance(ctx, instance.ID); err != nil && !errors.Is(err, context.Canceled) {
				slog.WarnContext(ctx, "instance supervision failed", "instance_id", instance.ID, "error", err)
			}
		})
	}
}

func supervisionEligible(metadata state.InstanceMetadata) bool {
	if isInternalBuilder(metadata) {
		return false
	}
	if metadata.State == types.RuntimeStateStarted {
		return true
	}
	return metadata.RestartPolicy != nil &&
		metadata.RestartStatus.BlockedReason != restartpolicy.BlockedReasonManualStop &&
		(metadata.State == types.RuntimeStateStopped || metadata.State == types.RuntimeStateError)
}

func (b *Backend) beginSupervision(id string) bool {
	b.supervisionMu.Lock()
	defer b.supervisionMu.Unlock()
	if _, exists := b.supervising[id]; exists {
		return false
	}
	b.supervising[id] = struct{}{}
	return true
}

func (b *Backend) endSupervision(id string) {
	b.supervisionMu.Lock()
	delete(b.supervising, id)
	b.supervisionMu.Unlock()
}

func (b *Backend) superviseInstance(ctx context.Context, id string) error {
	guard, err := b.lifecycle.Lock(ctx, id)
	if err != nil {
		return fmt.Errorf("acquire supervision lifecycle lock: %w", err)
	}
	defer guard.Release()
	metadata, err := b.readInstance(id)
	if err != nil {
		return err
	}
	if metadata.State == types.RuntimeStateStarted && !b.processRunning(ctx, metadata) {
		if err := b.recordUnexpectedExit(ctx, &metadata); err != nil {
			return err
		}
	}
	if metadata.State == types.RuntimeStateStarted {
		if err := b.runHealthCheckIfDue(ctx, &metadata); err != nil {
			return err
		}
		if restartStatusIsStable(metadata, time.Now().UTC()) {
			metadata.RestartStatus = restartpolicy.Status{}
			return b.writeInstance(metadata)
		}
		return nil
	}
	if metadata.RestartPolicy == nil || metadata.RestartStatus.BlockedReason == restartpolicy.BlockedReasonManualStop {
		return nil
	}
	return b.restartInstanceLocked(ctx, &metadata)
}

func restartStatusIsStable(metadata state.InstanceMetadata, now time.Time) bool {
	if metadata.RestartPolicy == nil || metadata.StartedAt == nil || metadata.RestartStatus.Attempts == 0 {
		return false
	}
	stableSince := metadata.StartedAt.UTC()
	if metadata.RestartStatus.LastAttemptAt != nil && metadata.RestartStatus.LastAttemptAt.After(stableSince) {
		stableSince = metadata.RestartStatus.LastAttemptAt.UTC()
	}
	return !now.Before(stableSince.Add(restartpolicy.StableAfter(metadata.RestartPolicy)))
}

func (b *Backend) recordUnexpectedExit(ctx context.Context, metadata *state.InstanceMetadata) error {
	if err := b.readWorkloadExit(metadata); err != nil {
		slog.WarnContext(ctx, "failed to read instance workload exit status", "instance_id", metadata.ID, "error", err)
	}
	if err := b.stopVM(ctx, metadata); err != nil {
		return fmt.Errorf("clean up exited instance process resources: %w", err)
	}
	if err := b.releaseGPUDevices(ctx, metadata); err != nil {
		return fmt.Errorf("release GPU lease after unexpected instance exit: %w", err)
	}
	now := time.Now().UTC()
	metadata.PID = 0
	metadata.StoppedAt = &now
	metadata.RestartStatus.LastReason = restartpolicy.ReasonUnexpectedExit
	if err := b.persistRuntimeState(metadata, types.RuntimeStateStopped); err != nil {
		return fmt.Errorf("persist unexpected instance exit: %w", err)
	}
	return nil
}

func (b *Backend) readWorkloadExit(metadata *state.InstanceMetadata) error {
	if metadata == nil || metadata.ExitCode != nil {
		return nil
	}
	record, found, err := exitinfo.ReadLatest(
		b.paths.InstanceAppLog(metadata.ID),
		exitinfo.DefaultTailSize,
		metadata.GenerationID,
	)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if found {
		code := record.Code
		metadata.ExitCode = &code
		metadata.ExitMessage = record.Message
	}
	return nil
}

func (b *Backend) runHealthCheckIfDue(ctx context.Context, metadata *state.InstanceMetadata) error {
	policy := metadata.HealthCheck
	if !healthcheck.Enabled(policy) || metadata.StartedAt == nil {
		return nil
	}
	timing, err := healthcheck.ParseTiming(policy)
	if err != nil {
		return fmt.Errorf("read health check timing: %w", err)
	}
	if metadata.HealthCheckRuntime != nil && metadata.HealthCheckRuntime.LastCheckedAt != nil &&
		time.Since(*metadata.HealthCheckRuntime.LastCheckedAt) < timing.Interval {
		return nil
	}

	probeCtx, cancel := context.WithTimeout(ctx, timing.Timeout)
	result, probeErr := runLifecycleOperation(
		b,
		metadata.ID,
		"",
		lifecycle.OperationHealthCheck,
		func() (healthcheck.ProbeResult, error) {
			probeResult := healthcheck.Prober{
				Dial:       b.guestDialer(*metadata),
				ExecProber: instanceExecProber{metadata: *metadata},
			}.Check(probeCtx, policy)
			if !probeResult.Success {
				return probeResult, errors.New(probeResult.Error)
			}
			return probeResult, nil
		},
	)
	cancel()
	if probeErr != nil && result.Error == "" {
		return fmt.Errorf("run health check: %w", probeErr)
	}
	metadata.HealthCheckRuntime = healthcheck.Apply(policy, metadata.HealthCheckRuntime, *metadata.StartedAt, time.Now(), result)
	if metadata.HealthCheckRuntime.Status != healthcheck.StatusUnhealthy || metadata.RestartPolicy == nil {
		return b.writeInstance(*metadata)
	}
	metadata.RestartStatus.LastReason = restartpolicy.ReasonHealthCheckFailed
	status, shouldRestart := restartpolicy.PrepareAttempt(metadata.RestartPolicy, metadata.RestartStatus, time.Now().UTC())
	metadata.RestartStatus = status
	if err := b.writeInstance(*metadata); err != nil {
		return err
	}
	if !shouldRestart {
		return nil
	}
	return b.performRestartAttemptLocked(ctx, metadata, status, true)
}

func (b *Backend) restartInstanceLocked(ctx context.Context, metadata *state.InstanceMetadata) error {
	exitCode := metadata.ExitCode
	if metadata.RestartStatus.LastReason == restartpolicy.ReasonHealthCheckFailed {
		exitCode = nil
	}
	if !restartpolicy.ShouldRestart(metadata.RestartPolicy, exitCode) {
		return nil
	}
	now := time.Now().UTC()
	status, shouldRestart := restartpolicy.PrepareAttempt(metadata.RestartPolicy, metadata.RestartStatus, now)
	metadata.RestartStatus = status
	if err := b.writeInstance(*metadata); err != nil {
		return err
	}
	if !shouldRestart {
		return nil
	}
	return b.performRestartAttemptLocked(ctx, metadata, status, false)
}

func (b *Backend) performRestartAttemptLocked(
	ctx context.Context,
	metadata *state.InstanceMetadata,
	status restartpolicy.Status,
	stopRunning bool,
) error {
	return runLifecycleAction(b, metadata.ID, lifecycle.OperationRestart, func() error {
		if stopRunning {
			if err := b.stopVM(ctx, metadata); err != nil {
				restartErr := fmt.Errorf("stop unhealthy instance: %w", err)
				return errors.Join(restartErr, b.persistFailedRestartAttempt(metadata.ID, status))
			}
			if err := b.releaseGPUDevices(ctx, metadata); err != nil {
				restartErr := fmt.Errorf("release GPU lease for unhealthy instance restart: %w", err)
				return errors.Join(restartErr, b.persistFailedRestartAttempt(metadata.ID, status))
			}
			now := time.Now().UTC()
			metadata.PID = 0
			metadata.StoppedAt = &now
			if err := b.persistRuntimeState(metadata, types.RuntimeStateStopped); err != nil {
				return errors.Join(err, b.persistFailedRestartAttempt(metadata.ID, status))
			}
		}
		if err := b.startLocked(ctx, metadata.ID, types.StartOptions{}); err != nil {
			return errors.Join(err, b.persistFailedRestartAttempt(metadata.ID, status))
		}
		return nil
	})
}

func (b *Backend) persistFailedRestartAttempt(instanceID string, status restartpolicy.Status) error {
	current, err := b.readInstance(instanceID)
	if err != nil {
		return err
	}
	current.RestartStatus = restartpolicy.FailedAttempt(current.RestartPolicy, status, time.Now().UTC())
	return b.writeInstance(current)
}

type instanceExecProber struct {
	metadata state.InstanceMetadata
}

func (prober instanceExecProber) Probe(ctx context.Context, check healthcheck.ExecCheck) error {
	client, err := guestcontrol.NewClient(prober.metadata.VsockSocket, prober.metadata.ControlAuthToken)
	if err != nil {
		return fmt.Errorf("create exec health check client: %w", err)
	}
	defer client.Close()
	result, err := client.ExecHealth(ctx, control.ExecHealthRequest{Command: check.Command, WorkingDir: check.WorkingDir})
	if err != nil {
		return fmt.Errorf("run exec health check: %w", err)
	}
	if result.ExitCode != 0 {
		return fmt.Errorf("exec health check exited with status %d: %s", result.ExitCode, result.Output)
	}
	return nil
}

// maintainNetworks re-applies host firewall integration that other tools flush
// and tracks host address changes in every sandbox namespace.
func (b *Backend) maintainNetworks(ctx context.Context) {
	ticker := time.NewTicker(networkMaintenanceInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		if err := b.networks.Maintain(ctx); err != nil {
			slog.WarnContext(ctx, "could not maintain sandbox networking", "error", err)
		}
	}
}
