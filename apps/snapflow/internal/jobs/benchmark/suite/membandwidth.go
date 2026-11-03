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
	"math"
	"time"
)

const (
	streamArrays               = 3
	streamArrayMaxBytes        = 2 * gibibyte
	streamArrayMaxWords        = streamArrayMaxBytes / uint64Bytes
	streamRepetitions          = 5
	streamTriadScalar          = 3
	streamTriadBytesPerElement = streamArrays * uint64Bytes
)

// measureBandwidth runs the STREAM Triad a = b + s*c over three regions of the filled
// buffer on every worker and reports the best repetition, counting STREAM's bytes moved.
// Integer arithmetic keeps the kernel memory-bound without floating-point hazards.
func measureBandwidth(ctx context.Context, words []uint64) (uint32, error) {
	length := min(uint64(len(words))/streamArrays, streamArrayMaxWords)
	if length == 0 {
		return 0, errors.New("the memory bandwidth benchmark needs three non-empty arrays")
	}
	target, left, right := words[:length], words[length:2*length], words[2*length:streamArrays*length]
	chunks := (length + wordsPerStreamBlock - 1) / wordsPerStreamBlock
	best := time.Duration(math.MaxInt64)
	for range streamRepetitions {
		startedAt := time.Now()
		if err := forEachBlock(ctx, chunks, shared(func(chunk uint64) error {
			start, end := chunk*wordsPerStreamBlock, min((chunk+1)*wordsPerStreamBlock, length)
			triad(target[start:end], left[start:end], right[start:end])
			return nil
		})); err != nil {
			return 0, fmt.Errorf("run the memory bandwidth triad: %w", err)
		}
		best = min(best, time.Since(startedAt))
	}
	return throughputMibps(streamTriadBytesPerElement*length, best), nil
}

func triad(target, left, right []uint64) {
	left, right = left[:len(target)], right[:len(target)]
	for index := range target {
		target[index] = left[index] + streamTriadScalar*right[index]
	}
}
