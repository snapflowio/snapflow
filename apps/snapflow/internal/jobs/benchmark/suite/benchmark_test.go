// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"bytes"
	"context"
	"encoding/hex"
	"slices"
	"testing"
	"time"
)

const (
	testCPUThreads     = 2
	testCPUDuration    = 50 * time.Millisecond
	testScoreWindow    = 2 * time.Second
	testMemoryBlocks   = 3
	testTouchPasses    = 2
	testGEMMDimension  = 16
	testGEMMTolerance  = 0.5
	testLeafCount      = 1000
	testSampleCount    = 3
	testStreamIndex    = 5
	testStreamBytes    = 64
	testCPUSeedThread  = 3
	testNonceFill      = 7
	testRootFill       = 9
	testPermutationKey = 0x1234
	expectedStreamKey  = "966921170f36d8d8473b508caeafb2ecd9fb7a0e015dd6f1f5451655005e5f35"
	expectedBlock      = "e907bf74a825e58687fc3d58fa9772e38c2a1bf3b2e5865dffda6d0be2fe2bd9ce35eabb50ebb803fb5f09e48a6176c16efa3da19d506ec0076baef95340e76f"
	expectedCPUSeed    = "2015528424311fdf5e369e42f2214323be3e855c25c553c7af87a9308534c5f2"
)

func expectedSampleIndices() []uint64 {
	return []uint64{394, 615, 485}
}

func testNonce() []byte {
	return bytes.Repeat([]byte{testNonceFill}, NonceBytes)
}

func TestProtocolMatchesTheAPIVerifierVectors(t *testing.T) {
	key := StreamKey(testNonce(), LabelMemory)
	if got := hex.EncodeToString(key[:]); got != expectedStreamKey {
		t.Fatalf("stream key = %s, want %s", got, expectedStreamKey)
	}
	block := make([]byte, testStreamBytes)
	if err := FillStreamBlock(key, testStreamIndex, block); err != nil {
		t.Fatal(err)
	}
	if got := hex.EncodeToString(block); got != expectedBlock {
		t.Fatalf("stream block = %s, want %s", got, expectedBlock)
	}
	root := bytes.Repeat([]byte{testRootFill}, DigestBytes)
	if got := SampleIndices(testNonce(), LabelMemory, root, testLeafCount, testSampleCount); !slices.Equal(got, expectedSampleIndices()) {
		t.Fatalf("sample indices = %v, want %v", got, expectedSampleIndices())
	}
	seed := CPUThreadSeed(testNonce(), testCPUSeedThread)
	if got := hex.EncodeToString(seed[:]); got != expectedCPUSeed {
		t.Fatalf("CPU seed = %s, want %s", got, expectedCPUSeed)
	}
}

func TestMerklePathsVerifyForEveryLeafAndTreeSize(t *testing.T) {
	for size := 1; size <= 17; size++ {
		leaves := make([][]byte, size)
		for index := range leaves {
			leaves[index] = []byte{byte(index)}
		}
		tree, err := newMerkleTree(leafHashes(leaves))
		if err != nil {
			t.Fatal(err)
		}
		for index, leaf := range leaves {
			if !verifyInclusion(uint64(index), uint64(size), leaf, tree.path(uint64(index)), tree.root()) {
				t.Fatalf("leaf %d of a %d-leaf tree does not verify", index, size)
			}
		}
	}
}

func TestCPUMeasurementRoundTrips(t *testing.T) {
	cpu, err := MeasureCPU(context.Background(), testNonce(), testCPUThreads, testCPUDuration)
	if err != nil {
		t.Fatal(err)
	}
	if cpu.GetThreads() != testCPUThreads || cpu.GetWorkMillis() < uint64(testCPUDuration.Milliseconds()) {
		t.Fatalf("CPU measurement = %d threads over %d ms", cpu.GetThreads(), cpu.GetWorkMillis())
	}
	if !verifyCPU(testNonce(), cpu) {
		t.Fatal("the CPU measurement does not verify")
	}
	cpu.Samples[0].Leaf[0] ^= 1
	if verifyCPU(testNonce(), cpu) {
		t.Fatal("a tampered CPU leaf verified")
	}
}

func TestCPUScoresComeFromEveryKernel(t *testing.T) {
	single, multi, err := MeasureCPUScores(context.Background(), testCPUThreads, CPUTiming{
		SingleThread: testScoreWindow,
		MultiThread:  WindowedPhase{Duration: 2 * testScoreWindow, Warmup: testScoreWindow, Window: testScoreWindow},
	})
	if err != nil {
		t.Fatal(err)
	}
	if single == 0 || multi == 0 {
		t.Fatalf("CPU scores = %d single-thread, %d all-thread", single, multi)
	}
}

func TestWindowedPhaseNeedsAWindowAfterWarmup(t *testing.T) {
	if windows, err := (WindowedPhase{Duration: testScoreWindow, Warmup: testScoreWindow, Window: testScoreWindow}).windows(); err == nil {
		t.Fatalf("a phase that is all warm-up was accepted with %d windows", windows)
	}
	if got, err := median([]float64{4, 1, 3, 2}); err != nil || got != 2.5 {
		t.Fatalf("median = %v (%v), want 2.5", got, err)
	}
}

func TestMemoryMeasurementFillsAndMeasuresTheBuffer(t *testing.T) {
	memory, err := MeasureMemory(context.Background(), testNonce(), testMemoryBlocks*StreamBlockBytes, testTouchPasses)
	if err != nil {
		t.Fatal(err)
	}
	if memory.GetBytes() != testMemoryBlocks*StreamBlockBytes || memory.GetBandwidthMibps() == 0 || memory.GetLatencyNs() == 0 {
		t.Fatalf("memory measurement = %+v", memory)
	}
}

func TestPagePermutationVisitsEveryPageOnce(t *testing.T) {
	for _, size := range []uint64{1, 2, 7, 64, 1000} {
		permutation := newPagePermutation(size, testPermutationKey)
		seen := make([]bool, size)
		for index := range size {
			page := permutation.at(index)
			if page >= size || seen[page] {
				t.Fatalf("permutation of %d pages repeats or leaves the range at %d", size, page)
			}
			seen[page] = true
		}
	}
}

func TestGEMMProofRoundTrips(t *testing.T) {
	leftKey, rightKey := GEMMKeys(testNonce(), 0)
	left, err := GEMMMatrix(leftKey, testGEMMDimension)
	if err != nil {
		t.Fatal(err)
	}
	right, err := GEMMMatrix(rightKey, testGEMMDimension)
	if err != nil {
		t.Fatal(err)
	}
	rows := referenceProductRows(left, right, testGEMMDimension)
	proof, err := ProveGEMM(testNonce(), 0, rows, 1)
	if err != nil {
		t.Fatal(err)
	}
	if !verifyGEMM(testNonce(), 0, testGEMMDimension, proof, testGEMMTolerance) {
		t.Fatal("the GEMM proof does not verify")
	}
	if verifyGEMM(testNonce(), 1, testGEMMDimension, proof, testGEMMTolerance) {
		t.Fatal("the GEMM proof of GPU 0 verified for GPU 1")
	}
}
