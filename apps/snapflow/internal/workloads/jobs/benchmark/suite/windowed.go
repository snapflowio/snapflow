// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"errors"
	"slices"
	"time"
)

const medianHalves = 2

type WindowedPhase struct {
	Duration time.Duration
	Warmup   time.Duration
	Window   time.Duration
}

func (phase WindowedPhase) windows() (int, error) {
	if phase.Window <= 0 || phase.Duration < phase.Window || phase.Warmup < 0 {
		return 0, errors.New("a windowed benchmark phase needs a positive window no longer than the phase")
	}
	windows := int(phase.Duration / phase.Window)
	if phase.warmupWindows() >= windows {
		return 0, errors.New("a windowed benchmark phase needs at least one window after its warm-up")
	}
	return windows, nil
}

func (phase WindowedPhase) warmupWindows() int {
	return int(phase.Warmup / phase.Window)
}

func median(values []float64) (float64, error) {
	if len(values) == 0 {
		return 0, errors.New("there are no values to take the median of")
	}
	sorted := slices.Sorted(slices.Values(values))
	middle := len(sorted) / medianHalves
	if len(sorted)%medianHalves == 0 {
		return (sorted[middle-1] + sorted[middle]) / medianHalves, nil
	}
	return sorted[middle], nil
}
