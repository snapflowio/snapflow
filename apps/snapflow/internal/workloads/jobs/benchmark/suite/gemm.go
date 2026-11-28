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
	"fmt"
	"math"
	"os"
	"os/exec"
	"strconv"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	HelperGEMMCommand    = "gemm"
	HelperVRAMCommand    = "vram"
	helperDeviceOrderEnv = "CUDA_DEVICE_ORDER=PCI_BUS_ID"
	flopsPerMultiplyAdd  = 2
	flopsPerTeraflop     = 1e12
	gemmMatrixCount      = 2
)

type GEMMProof struct {
	Root    []byte
	Samples []*machinev1alpha1.MerkleSample
	TFLOPS  uint32
}

func GEMMMatrix(key [DigestBytes]byte, dimension int) ([]byte, error) {
	matrix := make([]byte, dimension*dimension)
	for row := range dimension {
		elements := matrix[row*dimension : (row+1)*dimension]
		if err := FillStreamBlock(key, uint64(row), elements); err != nil {
			return nil, err
		}
		for column, value := range elements {
			elements[column] = byte(int8(value&gemmElementMask) - gemmElementOffset)
		}
	}
	return matrix, nil
}

func GEMMKeys(nonce []byte, gpu int) (left, right [DigestBytes]byte) {
	return StreamKey(nonce, IndexedLabel(LabelGEMMLeft, gpu)), StreamKey(nonce, IndexedLabel(LabelGEMMRight, gpu))
}

func ProveGEMM(nonce []byte, gpu int, rows [][]byte, tflops uint32) (GEMMProof, error) {
	tree, err := newMerkleTree(leafHashes(rows))
	if err != nil {
		return GEMMProof{}, err
	}
	samples, err := tree.samples(nonce, IndexedLabel(LabelGEMM, gpu), GEMMSampleCount, func(index uint64) ([]byte, error) {
		return rows[index], nil
	})
	if err != nil {
		return GEMMProof{}, err
	}
	return GEMMProof{Root: tree.root(), Samples: samples, TFLOPS: tflops}, nil
}

func measureGEMM(ctx context.Context, nonce []byte, cfg GPUConfig, gpu int) (GEMMProof, error) {
	windows, err := cfg.GEMM.windows()
	if err != nil {
		return GEMMProof{}, err
	}
	dimension := cfg.GEMMDimension
	leftKey, rightKey := GEMMKeys(nonce, gpu)
	input := make([]byte, 0, gemmMatrixCount*dimension*dimension)
	for _, key := range [][DigestBytes]byte{leftKey, rightKey} {
		matrix, err := GEMMMatrix(key, dimension)
		if err != nil {
			return GEMMProof{}, err
		}
		input = append(input, matrix...)
	}
	command := helperCommand(ctx, cfg.Helper, HelperGEMMCommand, strconv.Itoa(gpu), strconv.Itoa(dimension),
		helperSeconds(cfg.GEMM.Duration), helperSeconds(cfg.GEMM.Window))
	command.Stdin = bytes.NewReader(input)
	output, err := command.Output()
	if err != nil {
		return GEMMProof{}, fmt.Errorf("run the GEMM helper on GPU %d: %w", gpu, err)
	}
	timings, rows, err := parseGEMMOutput(output, dimension)
	if err != nil {
		return GEMMProof{}, fmt.Errorf("parse the GEMM helper output of GPU %d: %w", gpu, err)
	}
	if len(timings) != windows {
		return GEMMProof{}, fmt.Errorf("the GEMM helper on GPU %d returned %d of %d windows", gpu, len(timings), windows)
	}
	rates := make([]float64, 0, windows)
	for _, window := range timings[cfg.GEMM.warmupWindows():] {
		rates = append(rates, GEMMTFLOPS(dimension, window.iterations, window.elapsed))
	}
	tflops, err := median(rates)
	if err != nil {
		return GEMMProof{}, err
	}
	return ProveGEMM(nonce, gpu, rows, uint32(math.Round(tflops)))
}

func GEMMTFLOPS(dimension int, iterations uint64, elapsed time.Duration) float64 {
	if elapsed <= 0 {
		return 0
	}
	size := float64(dimension)
	operations := flopsPerMultiplyAdd * size * size * size * float64(iterations)
	return operations / elapsed.Seconds() / flopsPerTeraflop
}

func helperSeconds(duration time.Duration) string {
	return strconv.FormatInt(int64(duration/time.Second), 10)
}

func helperCommand(ctx context.Context, helper string, arguments ...string) *exec.Cmd {
	command := exec.CommandContext(ctx, helper, arguments...)
	command.Env = append(os.Environ(), helperDeviceOrderEnv)
	return command
}
