// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package canary

import (
	"context"
	"maps"
	"sync"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/sandbox"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	canaryVariable = "KCANARY"
	canaryValue    = "canary-nonce"
	canaryImage    = "registry.example.com/snapflow/canary:1.0"
	daemonVersion  = "1.0.0"

	testRuntimeIdentity = "sha256:runtime"
	testReleaseIdentity = "sha256:release"
)

type unusedRuntime struct {
	Runtime
}

type unusedSecrets struct {
	sandbox.SecretSource
}

type unusedMeter struct {
	sandbox.UsageMeter
}

type heldSnapshots struct{}

func (heldSnapshots) Ensure(ctx context.Context, ref string) (func(), error) {
	return func() {}, ctx.Err()
}

type recordingRuntime struct {
	Runtime
	mu        sync.Mutex
	secretEnv []map[string]string
}

func (recording *recordingRuntime) RuntimeInventory(ctx context.Context) ([]microvmtypes.RuntimeObservation, error) {
	return nil, ctx.Err()
}

func (recording *recordingRuntime) Materialize(ctx context.Context, request runtime.MaterializeRequest) (runtime.StartResult, error) {
	recording.mu.Lock()
	defer recording.mu.Unlock()
	recording.secretEnv = append(recording.secretEnv, maps.Clone(request.Secrets.GetEnv()))
	return runtime.StartResult{DaemonVersion: daemonVersion}, ctx.Err()
}

func canarySpec() *machinev1alpha1.SandboxSpec {
	return &machinev1alpha1.SandboxSpec{
		Mode: string(workload.SandboxModeEphemeral), UserId: "canary", OsUser: "snapflow",
		Resources: &machinev1alpha1.SandboxResources{CpuQuota: 1, MemoryQuota: 1, StorageQuota: 3},
		Source:    &machinev1alpha1.SandboxSpec_Image{Image: &machinev1alpha1.SandboxImage{Ref: canaryImage}},
	}
}

func testConfig(t *testing.T, sandboxRuntime Runtime, environment map[string]string) Config {
	t.Helper()
	metrics, err := sandbox.NewMetrics(prometheus.NewRegistry())
	if err != nil {
		t.Fatalf("NewMetrics() error = %v", err)
	}
	converger, err := sandbox.NewConverger(
		sandbox.ConvergerConfig{RuntimeIdentity: testRuntimeIdentity, ReleaseIdentity: testReleaseIdentity},
		sandbox.ConvergerDependencies{
			Runtime: sandboxRuntime, Secrets: unusedSecrets{}, Snapshots: heldSnapshots{}, Meter: unusedMeter{}, Metrics: metrics,
		},
	)
	if err != nil {
		t.Fatalf("NewConverger() error = %v", err)
	}
	return Config{
		Runtime: sandboxRuntime, LocalRuntimes: sandbox.NewLocalRuntimes(), Converger: converger, Environment: environment,
	}
}

func TestCanaryDesiredStateDeclaresSecretsExactlyWhenItProvidesThem(t *testing.T) {
	tests := map[string]struct {
		environment map[string]string
		want        bool
	}{
		"qualification canary with a secret environment": {
			environment: map[string]string{canaryVariable: canaryValue}, want: true,
		},
		"benchmark canary without secrets": {},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			canary, err := newInstance(testConfig(t, unusedRuntime{}, test.environment), canarySpec())
			if err != nil {
				t.Fatalf("prepare canary: %v", err)
			}
			if got := canary.desired.GetHasSecrets(); got != test.want {
				t.Fatalf("hasSecrets = %t, want %t", got, test.want)
			}
		})
	}
}

func TestCanaryConvergenceHandsItsEnvironmentToTheRuntime(t *testing.T) {
	recording := &recordingRuntime{}
	canary, err := newInstance(testConfig(t, recording, map[string]string{canaryVariable: canaryValue}), canarySpec())
	if err != nil {
		t.Fatalf("prepare canary: %v", err)
	}

	if err := canary.converge(t.Context(), machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_STARTED); err != nil {
		t.Fatalf("converge canary: %v", err)
	}

	if len(recording.secretEnv) != 1 || recording.secretEnv[0][canaryVariable] != canaryValue {
		t.Fatalf("runtime received secret environments %v, want %s", recording.secretEnv, canaryVariable)
	}
}
