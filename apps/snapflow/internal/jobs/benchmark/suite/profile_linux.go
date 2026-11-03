// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package suite

import (
	"fmt"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	cpuProofDuration = 20 * time.Second
	scoreWindow      = 10 * time.Second
)

const (
	registrationSingleThread   = 10 * time.Second
	registrationMultiThread    = 180 * time.Second
	registrationCPUWarmup      = 30 * time.Second
	registrationTouchPasses    = 3
	registrationRandomRead     = 15 * time.Second
	registrationReadLatency    = 5 * time.Second
	registrationSyncedWrite    = 5 * time.Second
	registrationSequentialRead = 10 * time.Second
	registrationGEMMDuration   = 300 * time.Second
	registrationGEMMWarmup     = 60 * time.Second
)

const (
	spotCheckSingleThread   = 5 * time.Second
	spotCheckMultiThread    = 30 * time.Second
	spotCheckCPUWarmup      = 10 * time.Second
	spotCheckTouchPasses    = 1
	spotCheckRandomRead     = 5 * time.Second
	spotCheckReadLatency    = 2 * time.Second
	spotCheckSyncedWrite    = 2 * time.Second
	spotCheckSequentialRead = 3 * time.Second
	spotCheckGEMMDuration   = 30 * time.Second
	spotCheckGEMMWarmup     = 10 * time.Second
)

type profileTiming struct {
	cpu         CPUTiming
	touchPasses int
	disk        DiskTiming
	gemm        WindowedPhase
}

// profileTimings maps each supported benchmark profile to its phase timings.
func profileTimings() map[machinev1alpha1.BenchmarkProfile]profileTiming {
	return map[machinev1alpha1.BenchmarkProfile]profileTiming{
		machinev1alpha1.BenchmarkProfile_BENCHMARK_PROFILE_REGISTRATION: {
			cpu: CPUTiming{
				Proof: cpuProofDuration, SingleThread: registrationSingleThread,
				MultiThread: WindowedPhase{Duration: registrationMultiThread, Warmup: registrationCPUWarmup, Window: scoreWindow},
			},
			touchPasses: registrationTouchPasses,
			disk: DiskTiming{
				RandomRead: registrationRandomRead, ReadLatency: registrationReadLatency,
				SyncedWrite: registrationSyncedWrite, SequentialRead: registrationSequentialRead,
			},
			gemm: WindowedPhase{Duration: registrationGEMMDuration, Warmup: registrationGEMMWarmup, Window: scoreWindow},
		},
		machinev1alpha1.BenchmarkProfile_BENCHMARK_PROFILE_SPOT_CHECK: {
			cpu: CPUTiming{
				Proof: cpuProofDuration, SingleThread: spotCheckSingleThread,
				MultiThread: WindowedPhase{Duration: spotCheckMultiThread, Warmup: spotCheckCPUWarmup, Window: scoreWindow},
			},
			touchPasses: spotCheckTouchPasses,
			disk: DiskTiming{
				RandomRead: spotCheckRandomRead, ReadLatency: spotCheckReadLatency,
				SyncedWrite: spotCheckSyncedWrite, SequentialRead: spotCheckSequentialRead,
			},
			gemm: WindowedPhase{Duration: spotCheckGEMMDuration, Warmup: spotCheckGEMMWarmup, Window: scoreWindow},
		},
	}
}

func checkProfile(profile machinev1alpha1.BenchmarkProfile) error {
	_, err := timingFor(profile)
	return err
}

func timingFor(profile machinev1alpha1.BenchmarkProfile) (profileTiming, error) {
	timing, supported := profileTimings()[profile]
	if !supported {
		return profileTiming{}, fmt.Errorf("benchmark profile %s is not supported", profile)
	}
	return timing, nil
}
