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
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"time"
	"unsafe"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"golang.org/x/sys/unix"
)

const (
	directIOAlignment = 4096
	diskFilePattern   = ".snapflow-benchmark-*"
	diskFileMode      = 0o600
)

// MeasureDisk measures disk performance over a bounded working set of incompressible,
// nonce-keyed blocks. It does not prove capacity: nonce-derived data is cheap to
// regenerate, so filling the whole disk would cost a full write and prove nothing.
func MeasureDisk(ctx context.Context, nonce []byte, directory string, bytes uint64, timing DiskTiming) (measurement *machinev1alpha1.DiskMeasurement, resultErr error) {
	blocks := bytes / StreamBlockBytes
	if blocks == 0 {
		return nil, errors.New("the disk benchmark needs at least one stream block")
	}
	file, err := openDirect(directory)
	if err != nil {
		return nil, err
	}
	defer func() {
		resultErr = errors.Join(resultErr, closeAndRemove(file))
	}()
	startedAt := time.Now()
	digests, err := writeDiskStream(ctx, file, nonce, blocks)
	if err != nil {
		return nil, err
	}
	writeMibps := throughputMibps(blocks*StreamBlockBytes, time.Since(startedAt))
	if err := verifyReadback(ctx, file, digests); err != nil {
		return nil, err
	}
	return measureDiskPerformance(ctx, file, blocks*StreamBlockBytes, writeMibps, timing)
}

func openDirect(directory string) (*os.File, error) {
	placeholder, err := os.CreateTemp(directory, diskFilePattern)
	if err != nil {
		return nil, fmt.Errorf("create the disk benchmark file: %w", err)
	}
	name := placeholder.Name()
	if err := placeholder.Close(); err != nil {
		return nil, errors.Join(fmt.Errorf("close the disk benchmark file: %w", err), os.Remove(name))
	}
	file, err := os.OpenFile(name, os.O_RDWR|unix.O_DIRECT, diskFileMode)
	if err != nil {
		return nil, errors.Join(fmt.Errorf("open the disk benchmark file for direct I/O: %w", err), os.Remove(name))
	}
	return file, nil
}

func closeAndRemove(file *os.File) error {
	closeErr := file.Close()
	if closeErr != nil {
		closeErr = fmt.Errorf("close the disk benchmark file: %w", closeErr)
	}
	removeErr := os.Remove(file.Name())
	if removeErr != nil {
		removeErr = fmt.Errorf("remove the disk benchmark file: %w", removeErr)
	}
	return errors.Join(closeErr, removeErr)
}

func writeDiskStream(ctx context.Context, file *os.File, nonce []byte, blocks uint64) ([][DigestBytes]byte, error) {
	key := StreamKey(nonce, LabelDisk)
	digests := make([][DigestBytes]byte, blocks)
	if err := forEachBlock(ctx, blocks, func() blockWorker {
		buffer := alignedBlock(StreamBlockBytes)
		return func(index uint64) error {
			if err := FillStreamBlock(key, index, buffer); err != nil {
				return err
			}
			digests[index] = sha256.Sum256(buffer)
			if _, err := file.WriteAt(buffer, int64(index*StreamBlockBytes)); err != nil {
				return fmt.Errorf("write disk benchmark block %d: %w", index, err)
			}
			return nil
		}
	}); err != nil {
		return nil, err
	}
	if err := file.Sync(); err != nil {
		return nil, fmt.Errorf("sync the disk benchmark file: %w", err)
	}
	return digests, nil
}

func verifyReadback(ctx context.Context, file *os.File, digests [][DigestBytes]byte) error {
	return forEachBlock(ctx, uint64(len(digests)), func() blockWorker {
		buffer := alignedBlock(StreamBlockBytes)
		return func(index uint64) error {
			if _, err := file.ReadAt(buffer, int64(index*StreamBlockBytes)); err != nil {
				return fmt.Errorf("read back disk benchmark block %d: %w", index, err)
			}
			if sha256.Sum256(buffer) != digests[index] {
				return fmt.Errorf("disk benchmark block %d did not read back as written", index)
			}
			return nil
		}
	})
}

func alignedBlock(size int) []byte {
	buffer := make([]byte, size+directIOAlignment)
	misalignment := int(uintptr(unsafe.Pointer(unsafe.SliceData(buffer))) % directIOAlignment)
	offset := (directIOAlignment - misalignment) % directIOAlignment
	return buffer[offset : offset+size : offset+size]
}
