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

package imagecache

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/snapflowio/microvm-go/ext4"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/hosttool"
)

const ext4SizeHeadroomDivisor = 2

func CreateExt4Disk(ctx context.Context, sourceDir, diskPath string, requestedBytes int64) (int64, error) {
	if requestedBytes <= 0 {
		return 0, errors.New("ext4 disk size must be positive")
	}
	size, err := directorySize(sourceDir)
	if err != nil {
		return 0, fmt.Errorf("calculate ext4 source size: %w", err)
	}
	minimum := size + size/ext4SizeHeadroomDivisor
	if minimum < requestedBytes {
		minimum = requestedBytes
	}
	return createExt4Disk(ctx, sourceDir, diskPath, alignToSector(minimum))
}

func createExt4Disk(ctx context.Context, sourceDir, diskPath string, diskBytes int64) (int64, error) {
	if err := os.MkdirAll(filepath.Dir(diskPath), filemode.SharedDirectory); err != nil {
		return 0, fmt.Errorf("create ext4 disk directory: %w", err)
	}

	file, err := os.Create(diskPath)
	if err != nil {
		return 0, fmt.Errorf("create ext4 disk: %w", err)
	}
	if err := file.Truncate(diskBytes); err != nil {
		return 0, errors.Join(
			fmt.Errorf("size ext4 disk: %w", err),
			wrapCloseError("close ext4 disk", file.Close()),
		)
	}
	if err := file.Close(); err != nil {
		return 0, fmt.Errorf("close ext4 disk: %w", err)
	}

	mkfsPath, err := ext4.MkfsPath()
	if err != nil {
		return 0, err
	}
	output, err := exec.CommandContext(context.WithoutCancel(ctx), mkfsPath, "-b", "4096", "-O", "^has_journal", "-d", sourceDir, "-F", diskPath).CombinedOutput()
	if err != nil {
		return 0, fmt.Errorf("mkfs.ext4: %w", hosttool.Failure(err, string(output)))
	}
	return alignDiskFile(diskPath)
}

func wrapCloseError(message string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", message, err)
}

const sectorSize int64 = 4096

func alignToSector(size int64) int64 {
	if size%sectorSize == 0 {
		return size
	}
	return ((size / sectorSize) + 1) * sectorSize
}

func alignDiskFile(path string) (int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return 0, fmt.Errorf("stat disk image: %w", err)
	}
	size := info.Size()
	aligned := alignToSector(size)
	if aligned != size {
		if err := os.Truncate(path, aligned); err != nil {
			return 0, fmt.Errorf("align disk image: %w", err)
		}
	}
	return aligned, nil
}

func directorySize(root string) (int64, error) {
	var total int64
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return fmt.Errorf("stat %s: %w", path, err)
		}
		total += info.Size()
		return nil
	})
	return total, err
}
