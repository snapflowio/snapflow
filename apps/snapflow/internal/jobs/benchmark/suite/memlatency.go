// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"errors"
	"math"
	"math/rand/v2"
	"time"
)

const (
	cacheLineBytes     = 64
	wordsPerCacheLine  = cacheLineBytes / uint64Bytes
	latencyRegionBytes = gibibyte
	latencyRegionWords = latencyRegionBytes / uint64Bytes
	minimumChaseSlots  = 2
)

// measureLatency links the cache lines of a region into one random cycle with
// Sattolo's algorithm, stored in place, then walks the whole cycle once.
func measureLatency(words []uint64, random *rand.Rand) (uint32, error) {
	slots := min(uint64(len(words)), latencyRegionWords) / wordsPerCacheLine
	if slots < minimumChaseSlots {
		return 0, errors.New("the memory latency benchmark needs at least two cache lines")
	}
	for slot := range slots {
		words[slot*wordsPerCacheLine] = slot
	}
	for slot := slots - 1; slot > 0; slot-- {
		other := random.Uint64N(slot)
		words[slot*wordsPerCacheLine], words[other*wordsPerCacheLine] = words[other*wordsPerCacheLine], words[slot*wordsPerCacheLine]
	}
	startedAt := time.Now()
	var slot uint64
	for range slots {
		slot = words[slot*wordsPerCacheLine]
	}
	elapsed := time.Since(startedAt)
	if slot != 0 {
		return 0, errors.New("the memory latency pointer chase did not close its cycle")
	}
	return uint32(math.Round(float64(elapsed.Nanoseconds()) / float64(slots))), nil
}
