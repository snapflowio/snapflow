// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package metrics

import (
	"sort"
	"sync"
	"time"
)

const (
	medianQuantile = 0.50
	tailQuantile   = 0.95
	percentScale   = 100
)

const (
	PhaseStarted       = "started"
	PhaseSucceeded     = "succeeded"
	PhaseFailed        = "failed"
	maxDurationSamples = 512
)

type Observation struct {
	Operation string
	Phase     string
	Reason    string
	Timestamp time.Time
	Duration  time.Duration
}

type OperationMetric struct {
	Operation         string            `json:"operation"`
	StartedCount      uint64            `json:"startedCount"`
	SucceededCount    uint64            `json:"succeededCount"`
	FailedCount       uint64            `json:"failedCount"`
	DroppedEventCount uint64            `json:"droppedEventCount"`
	OutcomeReasons    map[string]uint64 `json:"outcomeReasons,omitempty"`
	AverageDurationMs float64           `json:"averageDurationMs"`
	MaximumDurationMs float64           `json:"maximumDurationMs"`
	P50DurationMs     float64           `json:"p50DurationMs"`
	P95DurationMs     float64           `json:"p95DurationMs"`
	LastDurationMs    float64           `json:"lastDurationMs"`
	LastCompletedAt   *time.Time        `json:"lastCompletedAt,omitempty"`
} // @name LifecycleOperationMetric

type Snapshot []OperationMetric

type aggregate struct {
	started         uint64
	succeeded       uint64
	failed          uint64
	dropped         uint64
	totalDuration   time.Duration
	maximumDuration time.Duration
	lastDuration    time.Duration
	lastCompletedAt *time.Time
	durations       []time.Duration
	outcomeReasons  map[string]uint64
}

func (r *Recorder) RecordDroppedEvent(operation string) {
	if r == nil || operation == "" {
		return
	}
	r.mu.Lock()
	current := r.operations[operation]
	current.dropped++
	r.operations[operation] = current
	r.mu.Unlock()
}

type Recorder struct {
	mu         sync.RWMutex
	operations map[string]aggregate
}

func NewRecorder() *Recorder {
	return &Recorder{operations: make(map[string]aggregate)}
}

func (r *Recorder) Observe(observation Observation) {
	if r == nil || observation.Operation == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	current := r.operations[observation.Operation]
	switch observation.Phase {
	case PhaseStarted:
		current.started++
	case PhaseSucceeded, PhaseFailed:
		current.recordCompletion(observation)
	default:
		return
	}
	if observation.Reason != "" {
		if current.outcomeReasons == nil {
			current.outcomeReasons = make(map[string]uint64)
		}
		current.outcomeReasons[observation.Reason]++
	}
	r.operations[observation.Operation] = current
}

func (current *aggregate) recordCompletion(observation Observation) {
	if observation.Phase == PhaseSucceeded {
		current.succeeded++
	} else {
		current.failed++
	}
	duration := max(observation.Duration, 0)
	current.totalDuration += duration
	current.lastDuration = duration
	if len(current.durations) == maxDurationSamples {
		copy(current.durations, current.durations[1:])
		current.durations[len(current.durations)-1] = duration
	} else {
		current.durations = append(current.durations, duration)
	}
	current.maximumDuration = max(current.maximumDuration, duration)
	completedAt := observation.Timestamp.UTC()
	if completedAt.IsZero() {
		completedAt = time.Now().UTC()
	}
	current.lastCompletedAt = &completedAt
}

func (r *Recorder) Snapshot() Snapshot {
	if r == nil {
		return Snapshot{}
	}
	r.mu.RLock()
	metrics := make(Snapshot, 0, len(r.operations))
	for operation, current := range r.operations {
		completed := current.succeeded + current.failed
		average := time.Duration(0)
		if completed > 0 {
			average = current.totalDuration / time.Duration(completed)
		}
		metric := OperationMetric{
			Operation:         operation,
			StartedCount:      current.started,
			SucceededCount:    current.succeeded,
			FailedCount:       current.failed,
			DroppedEventCount: current.dropped,
			AverageDurationMs: durationMilliseconds(average),
			MaximumDurationMs: durationMilliseconds(current.maximumDuration),
			P50DurationMs:     durationMilliseconds(percentile(current.durations, medianQuantile)),
			P95DurationMs:     durationMilliseconds(percentile(current.durations, tailQuantile)),
			LastDurationMs:    durationMilliseconds(current.lastDuration),
			OutcomeReasons:    cloneCounts(current.outcomeReasons),
		}
		if current.lastCompletedAt != nil {
			completedAt := *current.lastCompletedAt
			metric.LastCompletedAt = &completedAt
		}
		metrics = append(metrics, metric)
	}
	r.mu.RUnlock()
	sort.Slice(metrics, func(i, j int) bool { return metrics[i].Operation < metrics[j].Operation })
	return metrics
}

func cloneCounts(source map[string]uint64) map[string]uint64 {
	if len(source) == 0 {
		return nil
	}
	clone := make(map[string]uint64, len(source))
	for key, count := range source {
		clone[key] = count
	}
	return clone
}

func percentile(values []time.Duration, quantile float64) time.Duration {
	if len(values) == 0 {
		return 0
	}
	ordered := append([]time.Duration(nil), values...)
	sort.Slice(ordered, func(i, j int) bool { return ordered[i] < ordered[j] })
	index := (len(ordered)*int(quantile*percentScale)+percentScale-1)/percentScale - 1
	index = min(max(index, 0), len(ordered)-1)
	return ordered[index]
}

func durationMilliseconds(duration time.Duration) float64 {
	return float64(duration) / float64(time.Millisecond)
}
