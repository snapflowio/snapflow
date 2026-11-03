// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package suite

import (
	"context"
	"errors"
	"time"

	"golang.org/x/sync/errgroup"
)

type diskOperation func() error

type diskPhase struct {
	elapsed time.Duration
	latency *latencyHistogram
}

func timedOperations(ctx context.Context, duration time.Duration, workers int, newOperation func(worker int) diskOperation) (diskPhase, error) {
	if workers <= 0 || duration <= 0 {
		return diskPhase{}, errors.New("a disk benchmark phase needs at least one worker and a positive duration")
	}
	group, groupContext := errgroup.WithContext(ctx)
	histograms := make([]*latencyHistogram, workers)
	startedAt := time.Now()
	deadline := startedAt.Add(duration)
	for worker := range workers {
		operation := newOperation(worker)
		histogram := newLatencyHistogram()
		histograms[worker] = histogram
		group.Go(func() error {
			for groupContext.Err() == nil {
				began := time.Now()
				if !began.Before(deadline) {
					return nil
				}
				if err := operation(); err != nil {
					return err
				}
				histogram.record(time.Since(began))
			}
			return groupContext.Err()
		})
	}
	if err := group.Wait(); err != nil {
		return diskPhase{}, err
	}
	return diskPhase{elapsed: time.Since(startedAt), latency: mergeHistograms(histograms)}, nil
}
