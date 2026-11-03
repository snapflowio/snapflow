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

	"golang.org/x/sync/errgroup"
)

const (
	cpuScoreScale     = 1_000
	singleThreadCount = 1
)

type CPUTiming struct {
	Proof        time.Duration
	SingleThread time.Duration
	MultiThread  WindowedPhase
}

type cpuTally struct {
	units   uint64
	elapsed time.Duration
}

type cpuTallies [][]cpuTally

func MeasureCPUScores(ctx context.Context, threads int, timing CPUTiming) (single, multi uint32, err error) {
	corpus := newCPUCorpus()
	single, err = cpuScore(ctx, corpus, singleThreadCount, WindowedPhase{Duration: timing.SingleThread, Window: timing.SingleThread})
	if err != nil {
		return 0, 0, fmt.Errorf("measure the single-thread CPU score: %w", err)
	}
	multi, err = cpuScore(ctx, corpus, threads, timing.MultiThread)
	if err != nil {
		return 0, 0, fmt.Errorf("measure the all-thread CPU score: %w", err)
	}
	return single, multi, nil
}

func cpuScore(ctx context.Context, corpus *cpuCorpus, threads int, phase WindowedPhase) (uint32, error) {
	windows, err := phase.windows()
	if err != nil {
		return 0, err
	}
	if threads <= 0 {
		return 0, errors.New("the CPU score needs at least one thread")
	}
	tallies := make([]cpuTallies, threads)
	group, groupContext := errgroup.WithContext(ctx)
	startedAt := time.Now()
	for thread := range threads {
		group.Go(func() (err error) {
			tallies[thread], err = runCPUWorker(groupContext, corpus, startedAt, phase.Window, windows)
			return err
		})
	}
	if err := group.Wait(); err != nil {
		return 0, err
	}
	scores := make([]float64, 0, windows)
	for window := phase.warmupWindows(); window < windows; window++ {
		if score, complete := windowScore(tallies, window); complete {
			scores = append(scores, score)
		}
	}
	score, err := median(scores)
	if err != nil {
		return 0, fmt.Errorf("no CPU score window completed every kernel: %w", err)
	}
	return uint32(math.Round(score)), nil
}

func runCPUWorker(ctx context.Context, corpus *cpuCorpus, startedAt time.Time, window time.Duration, windows int) (cpuTallies, error) {
	worker, err := newCPUWorker(corpus)
	if err != nil {
		return nil, err
	}
	defer worker.close()
	kernels := cpuKernels()
	tallies := make(cpuTallies, windows)
	for index := range tallies {
		tallies[index] = make([]cpuTally, len(kernels))
	}
	for ctx.Err() == nil {
		for kernel, definition := range kernels {
			began := time.Now()
			units, err := definition.run(worker)
			if err != nil {
				return nil, err
			}
			finished := time.Now()
			slot := int(finished.Sub(startedAt) / window)
			if slot >= windows {
				return tallies, nil
			}
			tallies[slot][kernel].units += units
			tallies[slot][kernel].elapsed += finished.Sub(began)
		}
	}
	return nil, ctx.Err()
}

// windowScore turns each kernel's rate per thread-second into a whole-machine rate,
// normalises it by the kernel's reference rate and returns the scaled geometric mean.
func windowScore(tallies []cpuTallies, window int) (float64, bool) {
	kernels := cpuKernels()
	var logSum float64
	for kernel, definition := range kernels {
		var total cpuTally
		for _, thread := range tallies {
			total.units += thread[window][kernel].units
			total.elapsed += thread[window][kernel].elapsed
		}
		if total.units == 0 || total.elapsed <= 0 {
			return 0, false
		}
		rate := float64(len(tallies)) * float64(total.units) / total.elapsed.Seconds()
		logSum += math.Log(rate / definition.reference)
	}
	return cpuScoreScale * math.Exp(logSum/float64(len(kernels))), true
}
