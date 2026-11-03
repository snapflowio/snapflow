// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"time"
	"unsafe"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const wordsPerStreamBlock = StreamBlockBytes / uint64Bytes

// MeasureMemory fills the buffer with nonce-keyed ChaCha blocks, which forces every
// page resident and leaves nothing for the host to deduplicate, then measures it.
func MeasureMemory(ctx context.Context, nonce []byte, bytes uint64, touchPasses int) (*machinev1alpha1.MemoryMeasurement, error) {
	blocks := bytes / StreamBlockBytes
	if blocks == 0 || touchPasses <= 0 {
		return nil, errors.New("the memory benchmark needs at least one stream block and one page-touch pass")
	}
	words := make([]uint64, blocks*wordsPerStreamBlock)
	key := StreamKey(nonce, LabelMemory)
	if err := forEachBlock(ctx, blocks, shared(func(index uint64) error {
		return FillStreamBlock(key, index, wordBytes(words[index*wordsPerStreamBlock:(index+1)*wordsPerStreamBlock]))
	})); err != nil {
		return nil, fmt.Errorf("fill guest memory: %w", err)
	}
	random := rand.New(rand.NewChaCha8(LabelledDigest(LabelMemoryOrder, nonce)))
	pageTouch, err := measurePageTouch(ctx, words, random, touchPasses)
	if err != nil {
		return nil, err
	}
	bandwidth, err := measureBandwidth(ctx, words)
	if err != nil {
		return nil, err
	}
	latency, err := measureLatency(words, random)
	if err != nil {
		return nil, err
	}
	return &machinev1alpha1.MemoryMeasurement{
		Bytes: blocks * StreamBlockBytes, BandwidthMibps: bandwidth, LatencyNs: latency, PageTouchP999Micros: pageTouch,
	}, nil
}

func wordBytes(words []uint64) []byte {
	return unsafe.Slice((*byte)(unsafe.Pointer(unsafe.SliceData(words))), len(words)*uint64Bytes)
}

func throughputMibps(bytes uint64, elapsed time.Duration) uint32 {
	if elapsed <= 0 {
		return 0
	}
	return uint32(float64(bytes) / mebibyte / elapsed.Seconds())
}
