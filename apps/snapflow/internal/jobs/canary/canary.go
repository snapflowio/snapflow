// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package canary

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/sandbox"
	"github.com/snapflowio/snapflow/internal/state"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	cleanupTimeout    = 15 * time.Second
	initialGeneration = 1
)

type Runtime interface {
	runtime.Sandboxes
	runtime.GuestServices
}

type Converger interface {
	Converge(context.Context, sandbox.Target) (state.SandboxConvergence, error)
}

type Config struct {
	Runtime       Runtime
	LocalRuntimes *sandbox.LocalRuntimes
	Converger     Converger
	Environment   map[string]string
}

type Body func(context.Context, *Session) error

type instance struct {
	converger Converger
	local     *sandbox.LocalWorkload
	desired   *machinev1alpha1.SandboxDesiredState
	record    *state.SandboxConvergence
}

func Run(ctx context.Context, cfg Config, spec *machinev1alpha1.SandboxSpec, body Body) (resultErr error) {
	defer workload.ClearSecrets(cfg.Environment)
	canary, err := newInstance(cfg, spec)
	if err != nil {
		return err
	}
	release := cfg.LocalRuntimes.Hold(canary.desired.GetSandboxId())
	defer release()
	defer func() {
		if cleanupErr := canary.cleanup(ctx, cfg.Runtime); cleanupErr != nil {
			resultErr = errors.Join(resultErr, cleanupErr)
		}
	}()
	if err := canary.converge(ctx, machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_STARTED); err != nil {
		return err
	}
	if strings.TrimSpace(canary.record.DaemonVersion) == "" {
		return errors.New("canary microVM toolbox did not become ready")
	}
	if err := body(ctx, &Session{runtime: cfg.Runtime, sandboxID: canary.desired.GetSandboxId()}); err != nil {
		return err
	}
	if err := canary.converge(ctx, machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_STOPPED); err != nil {
		return err
	}
	return canary.converge(ctx, machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_DESTROYED)
}

func newInstance(cfg Config, spec *machinev1alpha1.SandboxSpec) (*instance, error) {
	if cfg.Runtime == nil || cfg.LocalRuntimes == nil || cfg.Converger == nil {
		return nil, errors.New("the canary microVM needs a runtime, local runtimes and a converger")
	}
	specDigest, err := workload.ProtoJSONDigest(spec)
	if err != nil {
		return nil, fmt.Errorf("digest canary microVM spec: %w", err)
	}
	return &instance{converger: cfg.Converger, local: &sandbox.LocalWorkload{Env: cfg.Environment}, desired: &machinev1alpha1.SandboxDesiredState{
		SandboxId: uuid.NewString(), AssignmentGeneration: initialGeneration, Spec: spec, SpecDigest: specDigest,
		HasSecrets: len(cfg.Environment) > 0,
	}}, nil
}

func (canary *instance) converge(ctx context.Context, lifecycle machinev1alpha1.SandboxLifecycle) error {
	canary.desired.SpecGeneration++
	canary.desired.Lifecycle = lifecycle
	record, err := canary.converger.Converge(ctx, sandbox.Target{Desired: canary.desired, Record: canary.record, Local: canary.local})
	if err != nil {
		return fmt.Errorf("converge canary microVM to %s: %w", lifecycle, err)
	}
	canary.record = &record
	if record.FailureReason != "" {
		return fmt.Errorf("converge canary microVM to %s: %w", lifecycle,
			workload.ConvergenceFailure{Result: record.Result, Reason: record.FailureReason})
	}
	return nil
}

func (canary *instance) cleanup(ctx context.Context, sandboxRuntime Runtime) error {
	destroyed := canary.desired.GetLifecycle() == machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_DESTROYED &&
		canary.record != nil && canary.record.ObservedSpecGeneration == canary.desired.GetSpecGeneration() &&
		canary.record.FailureReason == ""
	if destroyed {
		return nil
	}
	cleanupContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer cancel()
	if err := sandboxRuntime.Destroy(cleanupContext, canary.desired.GetSandboxId()); err != nil {
		return fmt.Errorf("destroy canary microVM: %w", err)
	}
	return nil
}
