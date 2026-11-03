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
	"fmt"
	"math/rand/v2"
	"os"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"golang.org/x/sys/unix"
)

const (
	randomReadBytes       = 4 * kibibyte
	randomReadWorkers     = 32
	latencyWorkers        = 1
	syncedWriteBytes      = 8 * kibibyte
	sequentialReadBytes   = StreamBlockBytes
	sequentialReadWorkers = 4
	diskLatencyQuantile   = 0.99
)

type DiskTiming struct {
	RandomRead     time.Duration
	ReadLatency    time.Duration
	SyncedWrite    time.Duration
	SequentialRead time.Duration
}

func measureDiskPerformance(ctx context.Context, file *os.File, size uint64, writeMibps uint32, timing DiskTiming) (*machinev1alpha1.DiskMeasurement, error) {
	random, err := timedOperations(ctx, timing.RandomRead, randomReadWorkers, randomReads(file, size))
	if err != nil {
		return nil, err
	}
	latency, err := timedOperations(ctx, timing.ReadLatency, latencyWorkers, randomReads(file, size))
	if err != nil {
		return nil, err
	}
	synced, err := timedOperations(ctx, timing.SyncedWrite, latencyWorkers, syncedWrites(file, size))
	if err != nil {
		return nil, err
	}
	workers := int(min(sequentialReadWorkers, size/sequentialReadBytes))
	sequential, err := timedOperations(ctx, timing.SequentialRead, workers, sequentialReads(file, size, workers))
	if err != nil {
		return nil, err
	}
	return &machinev1alpha1.DiskMeasurement{
		RandomReadIops:        uint32(float64(random.latency.count()) / random.elapsed.Seconds()),
		SequentialReadMibps:   throughputMibps(sequential.latency.count()*sequentialReadBytes, sequential.elapsed),
		SequentialWriteMibps:  writeMibps,
		ReadLatencyP99Micros:  durationMicros(latency.latency.quantile(diskLatencyQuantile)),
		FsyncLatencyP99Micros: durationMicros(synced.latency.quantile(diskLatencyQuantile)),
	}, nil
}

func randomReads(file *os.File, size uint64) func(int) diskOperation {
	return func(int) diskOperation {
		buffer := alignedBlock(randomReadBytes)
		return func() error {
			offset := int64(rand.N(size/randomReadBytes) * randomReadBytes)
			if _, err := file.ReadAt(buffer, offset); err != nil {
				return fmt.Errorf("read disk benchmark offset %d: %w", offset, err)
			}
			return nil
		}
	}
}

func sequentialReads(file *os.File, size uint64, workers int) func(int) diskOperation {
	region := size / sequentialReadBytes / uint64(workers)
	return func(worker int) diskOperation {
		buffer := alignedBlock(sequentialReadBytes)
		var position uint64
		return func() error {
			offset := int64((uint64(worker)*region + position%region) * sequentialReadBytes)
			position++
			if _, err := file.ReadAt(buffer, offset); err != nil {
				return fmt.Errorf("read disk benchmark offset %d: %w", offset, err)
			}
			return nil
		}
	}
}

func syncedWrites(file *os.File, size uint64) func(int) diskOperation {
	return func(int) diskOperation {
		buffer := alignedBlock(syncedWriteBytes)
		descriptor := int(file.Fd())
		return func() error {
			offset := int64(rand.N(size/syncedWriteBytes) * syncedWriteBytes)
			if _, err := file.WriteAt(buffer, offset); err != nil {
				return fmt.Errorf("write disk benchmark offset %d: %w", offset, err)
			}
			if err := unix.Fdatasync(descriptor); err != nil {
				return fmt.Errorf("fdatasync the disk benchmark file: %w", err)
			}
			return nil
		}
	}
}
