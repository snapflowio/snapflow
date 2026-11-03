// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"context"
	"fmt"
	"math/bits"
	"math/rand/v2"
	"time"
)

const (
	pageBytes                   = 4 * kibibyte
	wordsPerPage                = pageBytes / uint64Bytes
	pageTouchChunkPages         = 4_096
	pageTouchQuantile           = 0.999
	permutationFirstMultiplier  = 0x9e3779b97f4a7c15
	permutationSecondMultiplier = 0xbf58476d1ce4e5b9
	permutationShiftDivisor     = 2
)

// pagePermutation is a keyed bijection on [0, size): an invertible mix on the
// enclosing power of two, cycle-walked back into range, so no index table is stored.
type pagePermutation struct {
	size  uint64
	mask  uint64
	key   uint64
	shift uint
}

func newPagePermutation(size, key uint64) pagePermutation {
	width := uint(bits.Len64(size - 1))
	return pagePermutation{size: size, mask: 1<<width - 1, key: key, shift: width/permutationShiftDivisor + 1}
}

func (permutation pagePermutation) at(index uint64) uint64 {
	value := index
	for {
		value = permutation.mix(value)
		if value < permutation.size {
			return value
		}
	}
}

func (permutation pagePermutation) mix(value uint64) uint64 {
	value = (value ^ permutation.key) & permutation.mask
	value = value * permutationFirstMultiplier & permutation.mask
	value ^= value >> permutation.shift
	value = value * permutationSecondMultiplier & permutation.mask
	return value ^ value>>permutation.shift
}

// measurePageTouch writes one word of every page in a random order on every worker
// and reports the p99.9 touch latency. Each touch is timed with a single monotonic
// clock read, so the tail that reveals host swapping or overcommit stays exact.
func measurePageTouch(ctx context.Context, words []uint64, random *rand.Rand, passes int) (uint32, error) {
	pages := uint64(len(words)) / wordsPerPage
	chunks := (pages + pageTouchChunkPages - 1) / pageTouchChunkPages
	histograms := []*latencyHistogram{}
	for range passes {
		permutation := newPagePermutation(pages, random.Uint64())
		if err := forEachBlock(ctx, chunks, func() blockWorker {
			histogram := newLatencyHistogram()
			histograms = append(histograms, histogram)
			return func(chunk uint64) error {
				last := time.Now()
				for index := chunk * pageTouchChunkPages; index < min((chunk+1)*pageTouchChunkPages, pages); index++ {
					words[permutation.at(index)*wordsPerPage]++
					now := time.Now()
					histogram.record(now.Sub(last))
					last = now
				}
				return nil
			}
		}); err != nil {
			return 0, fmt.Errorf("touch guest memory pages: %w", err)
		}
	}
	return durationMicros(mergeHistograms(histograms).quantile(pageTouchQuantile)), nil
}
