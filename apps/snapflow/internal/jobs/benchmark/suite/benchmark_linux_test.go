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
	"os"
	"path/filepath"
	"testing"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const (
	testDiskBlocks      = 5
	testDiskPhase       = 20 * time.Millisecond
	testHelperName      = "gpu-gemm"
	testHelperMode      = 0o700
	testVRAMBytes       = mebibyte
	testVRAMReserve     = "1073741824"
	testChallengeExpiry = time.Minute
)

const testVRAMHelper = `#!/bin/sh
[ "$1 $2 $3" = "vram 1 ` + testVRAMReserve + `" ] || exit 1
printf '\000\000\020\000\000\000\000\000'
`

func TestDiskMeasurementCoversEveryPhase(t *testing.T) {
	directory := t.TempDir()
	disk, err := MeasureDisk(context.Background(), testNonce(), directory, testDiskBlocks*StreamBlockBytes, DiskTiming{
		RandomRead: testDiskPhase, ReadLatency: testDiskPhase, SyncedWrite: testDiskPhase, SequentialRead: testDiskPhase,
	})
	if err != nil {
		t.Fatal(err)
	}
	if disk.GetRandomReadIops() == 0 || disk.GetSequentialReadMibps() == 0 || disk.GetSequentialWriteMibps() == 0 {
		t.Fatalf("disk measurement = %+v", disk)
	}
	if leftovers, err := filepath.Glob(filepath.Join(directory, diskFilePattern)); err != nil || len(leftovers) != 0 {
		t.Fatalf("the disk benchmark left %v behind (%v)", leftovers, err)
	}
}

func TestVRAMReportsTheHelperAllocation(t *testing.T) {
	helper := filepath.Join(t.TempDir(), testHelperName)
	if err := os.WriteFile(helper, []byte(testVRAMHelper), testHelperMode); err != nil {
		t.Fatal(err)
	}
	allocated, err := measureVRAM(context.Background(), helper, 1, gibibyte)
	if err != nil {
		t.Fatal(err)
	}
	if allocated != testVRAMBytes {
		t.Fatalf("VRAM = %d bytes, want %d", allocated, testVRAMBytes)
	}
}

func TestChallengesNeedAKnownProfile(t *testing.T) {
	challenge := &machinev1alpha1.BenchmarkMachinePayload{
		Nonce: hex.EncodeToString(testNonce()), SuiteVersion: SuiteVersion,
		Profile:   machinev1alpha1.BenchmarkProfile_BENCHMARK_PROFILE_SPOT_CHECK,
		ExpiresAt: timestamppb.New(time.Now().Add(testChallengeExpiry)),
	}
	if nonce, err := ChallengeNonce(challenge); err != nil || len(nonce) != NonceBytes {
		t.Fatalf("a spot-check challenge gave nonce %x (%v)", nonce, err)
	}
	challenge.Profile = machinev1alpha1.BenchmarkProfile_BENCHMARK_PROFILE_UNSPECIFIED
	if nonce, err := ChallengeNonce(challenge); err == nil {
		t.Fatalf("a challenge without a profile was accepted with nonce %x", nonce)
	}
	if plan, err := DefaultPlan(challenge.GetProfile(), t.TempDir()); err == nil {
		t.Fatalf("a plan without a profile was built: %+v", plan)
	}
}
