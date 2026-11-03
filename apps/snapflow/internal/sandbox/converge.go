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
	"maps"
	"net/http"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	microvmtypes "github.com/snapflowio/microvm-go/types"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/state"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const maximumReasonLength = 2048

var (
	errSuperseded = errors.New("sandbox generation was superseded")
	errRetry      = errors.New("sandbox convergence must be retried")
)

type runtimeMissingError struct{}

func (runtimeMissingError) Error() string     { return "the sandbox runtime no longer exists" }
func (runtimeMissingError) ErrorCode() string { return workload.ErrorCodeRuntimeMissing }

type staleAssignmentCoder interface {
	error
	ErrorCode() string
}

type ConvergerConfig struct {
	RuntimeIdentity string
	ReleaseIdentity string
}

type ConvergerDependencies struct {
	Runtime   sandboxruntime.Sandboxes
	Secrets   SecretSource
	Snapshots SnapshotSource
	Meter     UsageMeter
	Metrics   *Metrics
}

type Converger struct {
	runtime         sandboxruntime.Sandboxes
	secrets         SecretSource
	snapshots       SnapshotSource
	meter           UsageMeter
	metrics         *Metrics
	runtimeIdentity string
	releaseIdentity string
}

func NewConverger(cfg ConvergerConfig, deps ConvergerDependencies) (*Converger, error) {
	if deps.Runtime == nil || deps.Secrets == nil || deps.Snapshots == nil || deps.Meter == nil || deps.Metrics == nil {
		return nil, errors.New("converger runtime, secret source, snapshot source, usage meter and metrics are required")
	}
	if strings.TrimSpace(cfg.RuntimeIdentity) == "" || strings.TrimSpace(cfg.ReleaseIdentity) == "" {
		return nil, errors.New("converger runtime and release identities are required")
	}
	return &Converger{
		runtime: deps.Runtime, secrets: deps.Secrets, snapshots: deps.Snapshots, meter: deps.Meter, metrics: deps.Metrics,
		runtimeIdentity: cfg.RuntimeIdentity, releaseIdentity: cfg.ReleaseIdentity,
	}, nil
}

type Target struct {
	Desired *machinev1alpha1.SandboxDesiredState
	Record  *state.SandboxConvergence
	Local   *LocalWorkload
}

type LocalWorkload struct {
	Env map[string]string
}

func (converger *Converger) Converge(ctx context.Context, target Target) (state.SandboxConvergence, error) {
	run := converger.newRun(target)
	observation, err := converger.observe(ctx, run.assignment.SandboxID)
	if err != nil {
		return state.SandboxConvergence{}, fmt.Errorf("%w: inspect sandbox runtime: %w", errRetry, err)
	}
	actErr := run.act(ctx, observation)
	if errors.Is(actErr, errSuperseded) || errors.Is(actErr, errRetry) {
		return state.SandboxConvergence{}, actErr
	}
	if ctx.Err() != nil {
		return state.SandboxConvergence{}, errors.Join(actErr, ctx.Err())
	}
	return run.finish(actErr), nil
}

func (converger *Converger) observe(ctx context.Context, sandboxID string) (*microvmtypes.RuntimeObservation, error) {
	inventory, err := converger.runtime.RuntimeInventory(ctx)
	if err != nil {
		return nil, err
	}
	for index := range inventory {
		if inventory[index].ID == sandboxID && inventory[index].ControlPlaneManaged {
			return &inventory[index], nil
		}
	}
	return nil, nil
}

type run struct {
	converger  *Converger
	desired    *machinev1alpha1.SandboxDesiredState
	record     state.SandboxConvergence
	local      *LocalWorkload
	assignment sandboxruntime.Assignment
	startedAt  time.Time
	timings    map[string]uint32
}

func (converger *Converger) newRun(target Target) *run {
	record := state.SandboxConvergence{}
	if target.Record != nil {
		record = *target.Record
	}
	record.SandboxID = target.Desired.GetSandboxId()
	return &run{
		converger: converger, desired: target.Desired, record: record, local: target.Local,
		assignment: sandboxruntime.Assignment{
			SandboxID: target.Desired.GetSandboxId(), Generation: target.Desired.GetAssignmentGeneration(),
		},
		startedAt: time.Now(),
		timings:   make(map[string]uint32),
	}
}

func (run *run) step(operation string, action func() error) error {
	startedAt := time.Now()
	err := action()
	elapsed := time.Since(startedAt)
	run.timings[operation] = milliseconds(elapsed)
	run.converger.metrics.observe(operation, run.desired.GetSpec().GetMode(), elapsed, err)
	return err
}

func (run *run) secrets(ctx context.Context) (*machinev1alpha1.SandboxSecrets, error) {
	if !run.desired.GetHasSecrets() {
		return nil, nil
	}
	if run.local != nil {
		return &machinev1alpha1.SandboxSecrets{
			SandboxId: run.assignment.SandboxID, AssignmentGeneration: run.assignment.Generation,
			SpecGeneration: run.desired.GetSpecGeneration(), Env: maps.Clone(run.local.Env),
		}, nil
	}
	secrets, err := run.converger.secrets.Secrets(ctx, run.assignment, run.desired.GetSpecGeneration())
	switch {
	case err == nil:
		return secrets, nil
	case apierror.HasStatus(err, http.StatusConflict):
		return nil, fmt.Errorf("%w: %w", errSuperseded, err)
	case apierror.IsRetryable(err), apierror.HasStatus(err, http.StatusUnauthorized):
		return nil, fmt.Errorf("%w: %w", errRetry, err)
	default:
		return nil, err
	}
}

func (run *run) finish(err error) state.SandboxConvergence {
	record := run.record
	record.AssignmentGeneration = run.assignment.Generation
	record.ObservedSpecGeneration = run.desired.GetSpecGeneration()
	record.FailureReason = ""
	run.timings[workload.TimingTotal] = milliseconds(time.Since(run.startedAt))
	record.Result = run.converger.result(err, run.timings)
	var missing runtimeMissingError
	switch {
	case err == nil:
		record.SpecDigest = run.desired.GetSpecDigest()
	case errors.As(err, &missing):
	default:
		record.FailureReason = boundedReason(err.Error())
	}
	return record
}

func (converger *Converger) result(err error, timings map[string]uint32) *machinev1alpha1.ConvergenceResult {
	classification := workload.Classify(err)
	result := &machinev1alpha1.ConvergenceResult{
		Phase: classification.Phase, ErrorCode: classification.Code, Retryable: classification.Retryable,
		RuntimeIdentity: converger.runtimeIdentity, ReleaseIdentity: converger.releaseIdentity,
		TimingsMs: timings,
	}
	if err != nil {
		diagnostic := boundedReason(err.Error())
		result.Diagnostic = &diagnostic
	}
	return result
}

func isStaleAssignment(err error) bool {
	var coded staleAssignmentCoder
	return errors.As(err, &coded) && coded.ErrorCode() == sandboxruntime.StaleAssignmentErrorCode
}

func discardSecrets(secrets *machinev1alpha1.SandboxSecrets) {
	if secrets == nil {
		return
	}
	workload.ClearSecrets(secrets.Env)
}

func boundedReason(reason string) string {
	runes := []rune(strings.TrimSpace(reason))
	if len(runes) <= maximumReasonLength {
		return string(runes)
	}
	return string(runes[:maximumReasonLength])
}

func milliseconds(duration time.Duration) uint32 {
	return uint32(duration.Milliseconds())
}
