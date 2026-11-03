// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"math"
	"testing"
	"time"
)

const (
	testLatencySamples  = 10_000
	testLatencyWorkers  = 4
	testLatencyOutlier  = 50 * time.Millisecond
	testLatencyStep     = time.Microsecond
	testMedianQuantile  = 0.5
	testRelativeError   = 1.0 / latencySubBuckets
	testExactValueLimit = 2 * latencySubBuckets
)

func TestLatencyBucketsAreContiguousAndExactForSmallValues(t *testing.T) {
	for value := range uint64(testExactValueLimit) {
		if latencyBucket(value) != int(value) || latencyBucketFloor(int(value)) != value {
			t.Fatalf("value %d maps to bucket %d", value, latencyBucket(value))
		}
	}
	for bucket := 1; bucket < latencyBuckets; bucket++ {
		floor := latencyBucketFloor(bucket)
		if latencyBucket(floor) != bucket || latencyBucket(floor-1) != bucket-1 {
			t.Fatalf("bucket %d does not start at %d", bucket, floor)
		}
	}
	if latencyBucket(math.MaxUint64) != latencyBuckets-1 {
		t.Fatalf("the largest value maps to bucket %d of %d", latencyBucket(math.MaxUint64), latencyBuckets)
	}
}

func TestMergedLatencyQuantilesStayWithinTheBucketError(t *testing.T) {
	histograms := make([]*latencyHistogram, testLatencyWorkers)
	for worker := range histograms {
		histograms[worker] = newLatencyHistogram()
		for sample := worker; sample < testLatencySamples; sample += testLatencyWorkers {
			histograms[worker].record(time.Duration(sample+1) * testLatencyStep)
		}
	}
	histograms[0].record(testLatencyOutlier)
	merged := mergeHistograms(histograms)
	if merged.count() != testLatencySamples+1 {
		t.Fatalf("merged count = %d", merged.count())
	}
	for quantile, want := range map[float64]time.Duration{
		testMedianQuantile: testLatencySamples / 2 * testLatencyStep,
		pageTouchQuantile:  time.Duration(math.Ceil(pageTouchQuantile*(testLatencySamples+1))) * testLatencyStep,
		1:                  testLatencyOutlier,
	} {
		got := merged.quantile(quantile)
		if math.Abs(float64(got-want)) > testRelativeError*float64(want) {
			t.Fatalf("p%v = %v, want %v", quantile, got, want)
		}
	}
	if empty := newLatencyHistogram().quantile(pageTouchQuantile); empty != 0 {
		t.Fatalf("an empty histogram reports %v", empty)
	}
}
