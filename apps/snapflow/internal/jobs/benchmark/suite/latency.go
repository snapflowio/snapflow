// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"math"
	"math/bits"
	"time"
)

const (
	latencySubBucketBits = 5
	latencySubBuckets    = 1 << latencySubBucketBits
	latencyValueBits     = 64
	latencyBuckets       = (latencyValueBits - latencySubBucketBits + 1) * latencySubBuckets
)

// latencyHistogram is a log-linear histogram of nanosecond latencies: values below
// 2*latencySubBuckets are exact and every larger power of two is split into
// latencySubBuckets buckets, bounding the relative error to 1/latencySubBuckets.
// It is not safe for concurrent use; give each worker its own and merge them.
type latencyHistogram struct {
	counts [latencyBuckets]uint64
	total  uint64
}

func newLatencyHistogram() *latencyHistogram {
	return &latencyHistogram{}
}

func mergeHistograms(histograms []*latencyHistogram) *latencyHistogram {
	merged := newLatencyHistogram()
	for _, histogram := range histograms {
		for bucket, count := range histogram.counts {
			merged.counts[bucket] += count
		}
		merged.total += histogram.total
	}
	return merged
}

func (histogram *latencyHistogram) record(latency time.Duration) {
	histogram.counts[latencyBucket(uint64(max(latency, 0)))]++
	histogram.total++
}

func (histogram *latencyHistogram) count() uint64 {
	return histogram.total
}

func (histogram *latencyHistogram) quantile(quantile float64) time.Duration {
	rank := uint64(math.Ceil(quantile * float64(histogram.total)))
	var seen uint64
	for bucket, count := range histogram.counts {
		seen += count
		if count > 0 && seen >= rank {
			return time.Duration(min(latencyBucketFloor(bucket+1)-1, math.MaxInt64))
		}
	}
	return 0
}

func latencyBucket(value uint64) int {
	shift := max(bits.Len64(value)-latencySubBucketBits-1, 0)
	return shift*latencySubBuckets + int(value>>shift)
}

func latencyBucketFloor(bucket int) uint64 {
	shift := max(bucket/latencySubBuckets-1, 0)
	return uint64(bucket-shift*latencySubBuckets) << shift
}

func durationMicros(duration time.Duration) uint32 {
	return uint32(min(duration.Microseconds(), math.MaxUint32))
}
