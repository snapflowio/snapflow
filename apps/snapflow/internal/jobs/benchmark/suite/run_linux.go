// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package suite

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"runtime/debug"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

type Plan struct {
	CPUThreads        int
	CPU               CPUTiming
	MemoryBytes       uint64
	MemoryTouchPasses int
	DiskDirectory     string
	DiskBytes         uint64
	DiskTiming        DiskTiming
	SpeedtestStreams  int
	SpeedtestDuration time.Duration
	HTTPClient        *http.Client
	GPU               GPUConfig
}

func Run(ctx context.Context, challenge *machinev1alpha1.BenchmarkMachinePayload, plan Plan) (*machinev1alpha1.BenchmarkMeasurements, error) {
	nonce, err := ChallengeNonce(challenge)
	if err != nil {
		return nil, err
	}
	cpu, err := MeasureCPU(ctx, nonce, plan.CPUThreads, plan.CPU.Proof)
	if err != nil {
		return nil, fmt.Errorf("measure CPU: %w", err)
	}
	cpu.SingleThreadScore, cpu.MultiThreadScore, err = MeasureCPUScores(ctx, plan.CPUThreads, plan.CPU)
	if err != nil {
		return nil, fmt.Errorf("measure CPU: %w", err)
	}
	memoryBytes, err := memoryBudget(plan.MemoryBytes)
	if err != nil {
		return nil, fmt.Errorf("measure memory: %w", err)
	}
	memory, err := MeasureMemory(ctx, nonce, memoryBytes, plan.MemoryTouchPasses)
	if err != nil {
		return nil, fmt.Errorf("measure memory: %w", err)
	}
	// Hand the filled guest memory back to the kernel before the GPU helpers run.
	debug.FreeOSMemory()
	disk, err := MeasureDisk(ctx, nonce, plan.DiskDirectory, plan.DiskBytes, plan.DiskTiming)
	if err != nil {
		return nil, fmt.Errorf("measure disk: %w", err)
	}
	speedtests, err := measureRequestedNetwork(ctx, challenge, plan)
	if err != nil {
		return nil, fmt.Errorf("measure network: %w", err)
	}
	gpus, err := MeasureGPUs(ctx, nonce, plan.GPU)
	if err != nil {
		return nil, fmt.Errorf("measure GPUs: %w", err)
	}
	return &machinev1alpha1.BenchmarkMeasurements{
		Cpu: cpu, Memory: memory, Disk: disk, Speedtests: speedtests, Gpus: gpus,
	}, nil
}

// measureRequestedNetwork runs the Edge speedtest only when the challenge names one;
// spot checks measure the network through their own Edge canary instead.
func measureRequestedNetwork(ctx context.Context, challenge *machinev1alpha1.BenchmarkMachinePayload, plan Plan) ([]*machinev1alpha1.SpeedtestReceipt, error) {
	if challenge.GetSpeedtestUrl() == "" {
		return nil, nil
	}
	return MeasureNetwork(ctx, SpeedtestConfig{
		URL: challenge.GetSpeedtestUrl(), Token: challenge.GetSpeedtestToken(),
		Streams: plan.SpeedtestStreams, Duration: plan.SpeedtestDuration, Client: plan.HTTPClient,
	})
}

func ChallengeNonce(challenge *machinev1alpha1.BenchmarkMachinePayload) ([]byte, error) {
	if challenge.GetSuiteVersion() != SuiteVersion {
		return nil, fmt.Errorf("benchmark suite version %d is not supported", challenge.GetSuiteVersion())
	}
	if err := checkProfile(challenge.GetProfile()); err != nil {
		return nil, err
	}
	if expiresAt := challenge.GetExpiresAt(); expiresAt == nil || !time.Now().Before(expiresAt.AsTime()) {
		return nil, errors.New("the benchmark challenge has expired")
	}
	nonce, err := hex.DecodeString(challenge.GetNonce())
	if err != nil || len(nonce) != NonceBytes {
		return nil, errors.New("the benchmark challenge nonce must be 32 hex-encoded bytes")
	}
	return nonce, nil
}
