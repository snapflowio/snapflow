// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package benchmark

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	distributionreference "github.com/distribution/reference"
	"github.com/snapflowio/common-go/pkg/toolboxapi"
	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/jobs/canary"
	"github.com/snapflowio/snapflow/internal/sandbox"
	"github.com/snapflowio/snapflow/internal/state"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
)

const (
	guestUser         = "root"
	challengeVariable = "BENCHMARK_CHALLENGE"
	toolCommand       = "machine-benchmark run --challenge \"$" + challengeVariable + "\""
	idleCommand       = "sleep"
	idleArgument      = "infinity"
)

type Config struct {
	Runtime        canary.Runtime
	LocalRuntimes  *sandbox.LocalRuntimes
	Converger      canary.Converger
	Identity       *state.Identity
	HostInventory  func(context.Context) (*machinev1alpha1.HostInventory, error)
	BenchmarkImage string
}

func Run(ctx context.Context, cfg Config, job Job) (json.RawMessage, error) {
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	challenge, err := decodeChallenge(job, cfg.Identity.MachineID, time.Now())
	if err != nil {
		return nil, err
	}
	if err := assertIdle(ctx, cfg.Runtime); err != nil {
		return nil, err
	}
	hostInventory, err := cfg.HostInventory(ctx)
	if err != nil {
		return nil, fmt.Errorf("collect the host inventory: %w", err)
	}
	benchmarkContext, cancel := context.WithDeadline(ctx, challenge.GetExpiresAt().AsTime())
	defer cancel()
	measurements, err := measure(benchmarkContext, cfg, challenge)
	if err != nil {
		return nil, err
	}
	return sign(cfg.Identity, challenge, cfg.BenchmarkImage, measurements, hostInventory, time.Now())
}

func (cfg Config) validate() error {
	if cfg.Runtime == nil || cfg.LocalRuntimes == nil || cfg.Converger == nil || cfg.Identity == nil || cfg.HostInventory == nil {
		return errors.New("the machine benchmark needs a runtime, local runtimes, a converger, an identity and a host inventory")
	}
	if err := cfg.Identity.Validate(); err != nil {
		return fmt.Errorf("validate the machine benchmark identity: %w", err)
	}
	named, err := distributionreference.ParseNormalizedNamed(cfg.BenchmarkImage)
	if err != nil {
		return fmt.Errorf("the guest release benchmark image is invalid: %w", err)
	}
	if _, pinned := named.(distributionreference.Digested); !pinned {
		return errors.New("the guest release benchmark image must be pinned by digest")
	}
	return nil
}

func assertIdle(ctx context.Context, sandboxRuntime canary.Runtime) error {
	observations, err := sandboxRuntime.RuntimeInventory(ctx)
	if err != nil {
		return fmt.Errorf("inspect running sandboxes: %w", err)
	}
	for _, observation := range observations {
		if observation.Info.State == microvmtypes.RuntimeStateStarted {
			return errors.New("the machine benchmark needs an idle machine, but sandboxes are running")
		}
	}
	return nil
}

func measure(ctx context.Context, cfg Config, challenge *machinev1alpha1.BenchmarkMachinePayload) (*machinev1alpha1.BenchmarkMeasurements, error) {
	encoded, err := protojson.Marshal(challenge)
	if err != nil {
		return nil, fmt.Errorf("encode the machine benchmark challenge: %w", err)
	}
	measurements := &machinev1alpha1.BenchmarkMeasurements{}
	err = canary.Run(ctx, canary.Config{
		Runtime: cfg.Runtime, LocalRuntimes: cfg.LocalRuntimes, Converger: cfg.Converger,
	}, benchmarkSpec(challenge, cfg.BenchmarkImage, cfg.Identity.MachineID), func(ctx context.Context, session *canary.Session) error {
		timeout := uint32(time.Until(challenge.GetExpiresAt().AsTime()).Seconds())
		result, err := session.Execute(ctx, toolboxapi.ExecuteRequest{
			Command: toolCommand, Envs: map[string]string{challengeVariable: string(encoded)}, Timeout: &timeout,
		})
		if err != nil {
			return fmt.Errorf("run the machine benchmark tool: %w", err)
		}
		if result.ExitCode != 0 {
			return fmt.Errorf("the machine benchmark tool exited with %d: %s", result.ExitCode, result.Result)
		}
		if err := protojson.Unmarshal([]byte(result.Result), measurements); err != nil {
			return fmt.Errorf("decode the machine benchmark measurements: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return measurements, nil
}

func benchmarkSpec(challenge *machinev1alpha1.BenchmarkMachinePayload, image, machineID string) *machinev1alpha1.SandboxSpec {
	shape := challenge.GetShape()
	return &machinev1alpha1.SandboxSpec{
		Mode:         string(workload.SandboxModeStandard),
		Capabilities: []string{string(workload.SandboxCapabilityDeveloperTools), string(workload.SandboxCapabilityDirectIO)},
		UserId:       machineID, OsUser: guestUser,
		Resources: &machinev1alpha1.SandboxResources{
			CpuQuota: int32(shape.GetCpu()), MemoryQuota: int32(shape.GetMemoryGib()),
			StorageQuota: int32(shape.GetDiskGib()), GpuQuota: int32(shape.GetGpu()),
		},
		Source: &machinev1alpha1.SandboxSpec_Image{Image: &machinev1alpha1.SandboxImage{
			Ref: image, Entrypoint: []string{idleCommand, idleArgument},
		}},
	}
}
