// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"context"
	"crypto/sha256"
	"errors"
	"sync"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const cpuLeafBytes = 2 * DigestBytes

func HashChain(start [DigestBytes]byte, iterations int) [DigestBytes]byte {
	current := start
	for range iterations {
		current = sha256.Sum256(current[:])
	}
	return current
}

func MeasureCPU(ctx context.Context, nonce []byte, threads int, duration time.Duration) (*machinev1alpha1.CpuMeasurement, error) {
	if threads <= 0 || duration <= 0 {
		return nil, errors.New("the CPU benchmark needs at least one thread and a positive duration")
	}
	startedAt := time.Now()
	deadline := startedAt.Add(duration)
	chains := make([][][]byte, threads)
	var group sync.WaitGroup
	for thread := range threads {
		group.Go(func() { chains[thread] = runChain(ctx, CPUThreadSeed(nonce, thread), deadline) })
	}
	group.Wait()
	elapsed := time.Since(startedAt)
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	segments := len(chains[0])
	for _, chain := range chains {
		segments = min(segments, len(chain))
	}
	if segments == 0 {
		return nil, errors.New("the CPU benchmark completed no hash-chain segment")
	}
	leaves := make([][]byte, 0, segments*threads)
	for _, chain := range chains {
		leaves = append(leaves, chain[:segments]...)
	}
	tree, err := newMerkleTree(leafHashes(leaves))
	if err != nil {
		return nil, err
	}
	samples, err := tree.samples(nonce, LabelCPU, CPUSampleCount, func(index uint64) ([]byte, error) {
		return leaves[index], nil
	})
	if err != nil {
		return nil, err
	}
	return &machinev1alpha1.CpuMeasurement{
		Threads:             uint32(threads),
		IterationsPerThread: uint64(segments) * CPUSegmentIterations,
		Root:                tree.root(),
		Samples:             samples,
		WorkMillis:          uint64(elapsed.Milliseconds()),
	}, nil
}

func runChain(ctx context.Context, seed [DigestBytes]byte, deadline time.Time) [][]byte {
	segments := [][]byte{}
	start := seed
	for ctx.Err() == nil && time.Now().Before(deadline) {
		end := HashChain(start, CPUSegmentIterations)
		leaf := make([]byte, 0, cpuLeafBytes)
		segments = append(segments, append(append(leaf, start[:]...), end[:]...))
		start = end
	}
	return segments
}
