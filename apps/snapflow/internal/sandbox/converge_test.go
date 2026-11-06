// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"errors"
	"net/http"
	"slices"
	"testing"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/control/controltest"
	"github.com/snapflowio/snapflow/internal/state"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	started   = machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_STARTED
	stopped   = machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_STOPPED
	paused    = machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_PAUSED
	destroyed = machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_DESTROYED
)

func testConverger(t *testing.T, runtime *fakeRuntime, control *fakeControl) *Converger {
	t.Helper()
	converger, err := NewConverger(
		ConvergerConfig{RuntimeIdentity: testIdentity, ReleaseIdentity: testIdentity},
		ConvergerDependencies{Runtime: runtime, Secrets: control, Snapshots: &fakeSnapshots{}, Meter: fakeMeter{runtime: runtime}, Metrics: testMetrics(t)},
	)
	if err != nil {
		t.Fatalf("NewConverger() error = %v", err)
	}
	return converger
}

func convergedRecord(desired *machinev1alpha1.SandboxDesiredState) *state.SandboxConvergence {
	return &state.SandboxConvergence{
		SandboxID: desired.GetSandboxId(), AssignmentGeneration: desired.GetAssignmentGeneration(),
		Materialized: true, ObservedSpecGeneration: desired.GetSpecGeneration() - 1, SpecDigest: desired.GetSpecDigest(),
	}
}

const resizedCPU = 4

func previousSpecRecord(desired *machinev1alpha1.SandboxDesiredState) *state.SandboxConvergence {
	record := convergedRecord(desired)
	record.SpecDigest = "previous"
	return record
}

func resizedSandbox(t *testing.T, lifecycle machinev1alpha1.SandboxLifecycle) *machinev1alpha1.SandboxDesiredState {
	t.Helper()
	desired := desiredSandbox(t, testSandboxID, 1, 2, lifecycle)
	desired.Spec.Resources.CpuQuota = resizedCPU
	digest, err := workload.ProtoJSONDigest(desired.GetSpec())
	if err != nil {
		t.Fatalf("digest spec: %v", err)
	}
	desired.SpecDigest = digest
	return desired
}

type convergeCase struct {
	desired     func(*testing.T) *machinev1alpha1.SandboxDesiredState
	hosted      microvmtypes.RuntimeState
	generation  int
	record      func(*machinev1alpha1.SandboxDesiredState) *state.SandboxConvergence
	operations  []string
	final       microvmtypes.RuntimeState
	missing     bool
	wantCPUVCPU int64
	held        bool
}

func TestConvergeDecisionTable(t *testing.T) {
	tests := map[string]convergeCase{
		"create started from image": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 1, started)
			},
			operations: []string{operationMaterialize, operationSample}, final: microvmtypes.RuntimeStateStarted,
		},
		"create stopped from image": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 1, stopped)
			},
			operations: []string{operationMaterialize, operationSample}, final: microvmtypes.RuntimeStateStopped,
		},
		"create paused": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 1, paused)
			},
			operations: []string{operationMaterialize, operationPause, operationSample}, final: microvmtypes.RuntimeStateStandby,
		},
		"lost runtime is missing, never recreated": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 2, started)
			},
			record: convergedRecord, missing: true,
		},
		"lost runtime of an older assignment is recreated": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 2, 2, started)
			},
			record: func(desired *machinev1alpha1.SandboxDesiredState) *state.SandboxConvergence {
				record := convergedRecord(desired)
				record.AssignmentGeneration = 1
				return record
			},
			operations: []string{operationMaterialize, operationSample}, final: microvmtypes.RuntimeStateStarted,
		},
		"start a stopped runtime": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 2, started)
			},
			hosted: microvmtypes.RuntimeStateStopped, generation: 1, record: convergedRecord,
			operations: []string{operationStart, operationSample}, final: microvmtypes.RuntimeStateStarted,
		},
		"resume a paused runtime": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 2, started)
			},
			hosted: microvmtypes.RuntimeStateStandby, generation: 1, record: convergedRecord,
			operations: []string{operationResume, operationSample}, final: microvmtypes.RuntimeStateStarted,
		},
		"force stop": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				desired := desiredSandbox(t, testSandboxID, 1, 2, stopped)
				desired.Directives = &machinev1alpha1.SandboxDirectives{ForceStop: true}
				return desired
			},
			hosted: microvmtypes.RuntimeStateStarted, generation: 1, record: convergedRecord,
			operations: []string{operationStop + forcedSuffix, operationMeter}, final: microvmtypes.RuntimeStateStopped,
		},
		"pause a started runtime": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 2, paused)
			},
			hosted: microvmtypes.RuntimeStateStarted, generation: 1, record: convergedRecord,
			operations: []string{operationPause, operationMeter}, final: microvmtypes.RuntimeStateStandby,
		},
		"resize a stopped runtime on a spec change": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return resizedSandbox(t, stopped)
			},
			hosted: microvmtypes.RuntimeStateStopped, generation: 1, record: previousSpecRecord,
			operations: []string{operationResize, operationNetwork}, final: microvmtypes.RuntimeStateStopped,
		},
		"update only the network when the resources already match": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 2, stopped)
			},
			hosted: microvmtypes.RuntimeStateStopped, generation: 1, record: previousSpecRecord,
			operations: []string{operationNetwork}, final: microvmtypes.RuntimeStateStopped,
		},
		"resize a stopped runtime before starting it": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return resizedSandbox(t, started)
			},
			hosted: microvmtypes.RuntimeStateStopped, generation: 1, record: previousSpecRecord,
			operations:  []string{operationResize, operationNetwork, operationStart, operationSample},
			final:       microvmtypes.RuntimeStateStarted,
			wantCPUVCPU: resizedCPU,
		},
		"resize a runtime whose recorded spec digest is already current": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return resizedSandbox(t, started)
			},
			hosted: microvmtypes.RuntimeStateStopped, generation: 1, record: convergedRecord,
			operations:  []string{operationResize, operationStart, operationSample},
			final:       microvmtypes.RuntimeStateStarted,
			wantCPUVCPU: resizedCPU,
		},
		"never resize a running runtime": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return resizedSandbox(t, started)
			},
			hosted: microvmtypes.RuntimeStateStarted, generation: 1, record: previousSpecRecord,
			operations: []string{operationNetwork, operationReady}, final: microvmtypes.RuntimeStateStarted,
		},
		"recover in place": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				desired := desiredSandbox(t, testSandboxID, 1, 2, stopped)
				desired.Directives = &machinev1alpha1.SandboxDirectives{Recovery: &machinev1alpha1.SandboxRecovery{}}
				return desired
			},
			hosted: microvmtypes.RuntimeStateError, generation: 1, record: convergedRecord,
			operations: []string{operationRecover}, final: microvmtypes.RuntimeStateStopped,
		},
		"adopt a placement replaced in place": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 2, 2, started)
			},
			hosted: microvmtypes.RuntimeStateStarted, generation: 1,
			record: func(desired *machinev1alpha1.SandboxDesiredState) *state.SandboxConvergence {
				record := convergedRecord(desired)
				record.AssignmentGeneration = 1
				return record
			},
			operations: []string{operationAdopt, operationReady}, final: microvmtypes.RuntimeStateStarted,
		},
		"destroy": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 2, destroyed)
			},
			hosted: microvmtypes.RuntimeStateStarted, generation: 1, record: convergedRecord,
			operations: []string{operationMeter, operationDestroy},
		},
		"payment hold pauses a started runtime": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 2, started)
			},
			hosted: microvmtypes.RuntimeStateStarted, generation: 1, record: convergedRecord, held: true,
			operations: []string{operationPause, operationMeter}, final: microvmtypes.RuntimeStateStandby,
		},
		"payment hold keeps a paused runtime paused": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 2, started)
			},
			hosted: microvmtypes.RuntimeStateStandby, generation: 1, record: convergedRecord, held: true,
			final: microvmtypes.RuntimeStateStandby,
		},
		"payment hold never boots a stopped runtime": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 2, started)
			},
			hosted: microvmtypes.RuntimeStateStopped, generation: 1, record: convergedRecord, held: true,
			final: microvmtypes.RuntimeStateStopped,
		},
		"payment hold still lets the API stop the sandbox": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 2, stopped)
			},
			hosted: microvmtypes.RuntimeStateStandby, generation: 1, record: convergedRecord, held: true,
			operations: []string{operationStop, operationMeter}, final: microvmtypes.RuntimeStateStopped,
		},
		"payment hold creates a sandbox without starting it": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 1, started)
			},
			held:       true,
			operations: []string{operationMaterialize, operationSample}, final: microvmtypes.RuntimeStateStopped,
		},
	}
	for name, test := range tests {
		t.Run(name, test.run)
	}
}

func (test convergeCase) run(t *testing.T) {
	runtime := newFakeRuntime()
	if test.hosted != "" {
		runtime.host(testSandboxID, test.generation, test.hosted)
	}
	desired := test.desired(t)
	target := Target{Desired: desired, PaymentHeld: test.held}
	if test.record != nil {
		target.Record = test.record(desired)
	}
	record, err := testConverger(t, runtime, &fakeControl{}).Converge(t.Context(), target)
	if err != nil {
		t.Fatalf("Converge() error = %v", err)
	}
	if record.FailureReason != "" || record.ObservedSpecGeneration != desired.GetSpecGeneration() ||
		record.AssignmentGeneration != desired.GetAssignmentGeneration() || record.PaymentHeld != test.held {
		t.Fatalf("record = %+v", record)
	}
	hosted := test.assertRuntime(t, runtime)
	wantCode := machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_NONE
	if test.missing {
		wantCode = machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_RUNTIME_MISSING
		if hosted {
			t.Fatal("a lost runtime was recreated")
		}
	}
	if record.Result.GetErrorCode() != wantCode {
		t.Fatalf("result error code = %q, want %q", record.Result.GetErrorCode(), wantCode)
	}
}

func (test convergeCase) assertRuntime(t *testing.T, runtime *fakeRuntime) (hosted bool) {
	t.Helper()
	if got := runtime.recorded(); !slices.Equal(got, test.operations) {
		t.Fatalf("operations = %v, want %v", got, test.operations)
	}
	current, hosted := runtime.state(testSandboxID)
	if test.final != "" && current != test.final {
		t.Fatalf("runtime state = %s, want %s", current, test.final)
	}
	if cpu := runtime.cpu(testSandboxID); test.wantCPUVCPU != 0 && cpu != test.wantCPUVCPU {
		t.Fatalf("runtime vCPUs = %d, want %d", cpu, test.wantCPUVCPU)
	}
	return hosted
}

func withSecrets(desired *machinev1alpha1.SandboxDesiredState) *machinev1alpha1.SandboxDesiredState {
	desired.HasSecrets = true
	return desired
}

func TestConvergeClearsSecretsAfterUse(t *testing.T) {
	runtime := newFakeRuntime()
	control := &fakeControl{}
	if _, err := testConverger(t, runtime, control).Converge(t.Context(), Target{Desired: withSecrets(desiredSandbox(t, testSandboxID, 1, 1, started))}); err != nil {
		t.Fatalf("Converge() error = %v", err)
	}
	if len(runtime.secrets) != 1 || len(control.reportedEnv) != 1 {
		t.Fatalf("secrets were fetched %d times and handed over %d times", len(control.reportedEnv), len(runtime.secrets))
	}
	if len(runtime.secrets[0]) != 0 {
		t.Fatal("the secret environment was retained after the runtime consumed it")
	}
}

func TestConvergeFetchesSecretsOnlyForSandboxesThatHaveThem(t *testing.T) {
	tests := map[string]struct {
		desired func(*testing.T) *machinev1alpha1.SandboxDesiredState
		hosted  bool
		fetches int
	}{
		"materialize without secrets": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 1, started)
			},
		},
		"materialize with secrets": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return withSecrets(desiredSandbox(t, testSandboxID, 1, 1, started))
			},
			fetches: 1,
		},
		"boot without secrets": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return desiredSandbox(t, testSandboxID, 1, 2, started)
			},
			hosted: true,
		},
		"boot with secrets": {
			desired: func(t *testing.T) *machinev1alpha1.SandboxDesiredState {
				return withSecrets(desiredSandbox(t, testSandboxID, 1, 2, started))
			},
			hosted:  true,
			fetches: 1,
		},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			runtime := newFakeRuntime()
			control := &fakeControl{}
			desired := test.desired(t)
			target := Target{Desired: desired}
			if test.hosted {
				runtime.host(testSandboxID, 1, microvmtypes.RuntimeStateStopped)
				target.Record = convergedRecord(desired)
			}
			record, err := testConverger(t, runtime, control).Converge(t.Context(), target)
			if err != nil || record.FailureReason != "" {
				t.Fatalf("Converge() = %+v, %v", record, err)
			}
			if got := len(control.reportedEnv); got != test.fetches {
				t.Fatalf("secrets were fetched %d times, want %d", got, test.fetches)
			}
			if current, _ := runtime.state(testSandboxID); current != microvmtypes.RuntimeStateStarted {
				t.Fatalf("runtime state = %s, want started", current)
			}
		})
	}
}

func TestConvergeRecordsRuntimeFailures(t *testing.T) {
	runtime := newFakeRuntime()
	runtime.failWith = errors.New("no space left on device")
	record, err := testConverger(t, runtime, &fakeControl{}).Converge(t.Context(), Target{Desired: desiredSandbox(t, testSandboxID, 1, 1, started)})
	if err != nil {
		t.Fatalf("Converge() error = %v", err)
	}
	if record.FailureReason == "" || record.ObservedSpecGeneration != 1 || record.Materialized {
		t.Fatalf("record = %+v", record)
	}
	status, reportable := observedStatus(sandboxView{sandboxID: testSandboxID, record: &record}, time.Now())
	if !reportable || status.GetState() != machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_ERROR || !status.GetRecoverable() {
		t.Fatalf("status = %v", status)
	}
}

func TestConvergeDoesNotRecordUnfinishedGenerations(t *testing.T) {
	tests := map[string]struct {
		secretsErr error
		generation int
		want       error
	}{
		"secrets of a superseded generation": {secretsErr: controltest.StatusError(staleErrorStatus), want: errSuperseded},
		"secrets temporarily unavailable":    {secretsErr: controltest.StatusError(http.StatusServiceUnavailable), want: errRetry},
		"secrets of a rejected session":      {secretsErr: controltest.StatusError(http.StatusUnauthorized), want: errRetry},
		"runtime holds a newer assignment":   {generation: 2, want: errSuperseded},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			runtime := newFakeRuntime()
			desired := withSecrets(desiredSandbox(t, testSandboxID, 1, 1, started))
			if test.generation > 0 {
				runtime.host(testSandboxID, test.generation, microvmtypes.RuntimeStateStopped)
			}
			control := &fakeControl{secretsErr: test.secretsErr}
			if _, err := testConverger(t, runtime, control).Converge(t.Context(), Target{Desired: desired}); !errors.Is(err, test.want) {
				t.Fatalf("Converge() error = %v, want %v", err, test.want)
			}
			if slices.Contains(runtime.recorded(), operationMaterialize) || slices.Contains(runtime.recorded(), operationStart) {
				t.Fatalf("the runtime was changed: %v", runtime.recorded())
			}
		})
	}
}

func TestConvergeWaitsOutRuntimeTransitions(t *testing.T) {
	runtime := newFakeRuntime()
	runtime.host(testSandboxID, 1, microvmtypes.RuntimeStateStopping)
	desired := desiredSandbox(t, testSandboxID, 1, 2, started)
	if _, err := testConverger(t, runtime, &fakeControl{}).Converge(t.Context(), Target{Desired: desired, Record: convergedRecord(desired)}); !errors.Is(err, errRetry) {
		t.Fatalf("Converge() error = %v, want errRetry", err)
	}
}

func TestConvergeLocalWorkloadUsesItsOwnSecretsAndIsUnmetered(t *testing.T) {
	runtime := newFakeRuntime()
	control := &fakeControl{}
	desired := withSecrets(desiredSandbox(t, testSandboxID, 1, 1, started))
	local := &LocalWorkload{Env: map[string]string{testSecretName: testSecretValue}}
	record, err := testConverger(t, runtime, control).Converge(t.Context(), Target{Desired: desired, Local: local})
	if err != nil || record.FailureReason != "" {
		t.Fatalf("Converge() = %+v, %v", record, err)
	}
	if len(control.reportedEnv) != 0 {
		t.Fatal("a local workload fetched secrets from the control plane")
	}
	if len(runtime.secrets) != 1 || len(local.Env) != 1 {
		t.Fatalf("handed over secrets %v, local environment %v", runtime.secrets, local.Env)
	}
	if got := runtime.recorded(); !slices.Equal(got, []string{operationMaterialize}) {
		t.Fatalf("operations = %v, want an unmetered materialize", got)
	}
}
