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

package runtime

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/snapflowio/microvm-go/ext4"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/forkvm"
	"github.com/snapflowio/microvm-go/internal/hosttool"
)

const (
	defaultOverlayBytes int64 = 10 * 1024 * 1024 * 1024
	minOverlayBytes     int64 = 64 * 1024 * 1024
	sectorSize          int64 = 4096
)

func (b *Backend) createOverlayDisk(ctx context.Context, path string, sizeGiB int64) error {
	sizeBytes := gibibytes(sizeGiB)
	if sizeBytes <= 0 {
		sizeBytes = defaultOverlayBytes
	}
	sizeBytes = align(max(sizeBytes, minOverlayBytes))
	template := b.paths.SystemOverlayTemplate(sizeBytes)
	prepared := <-b.overlayTemplates.DoChan(template, func() (any, error) {
		return template, ensureOverlayTemplate(ctx, template, sizeBytes)
	})
	if prepared.Err != nil {
		return prepared.Err
	}
	if err := os.MkdirAll(filepath.Dir(path), filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create overlay directory: %w", err)
	}
	if err := forkvm.CopyFile(template, path); err != nil {
		return fmt.Errorf("clone empty overlay disk: %w", err)
	}
	return nil
}

func ensureOverlayTemplate(ctx context.Context, template string, sizeBytes int64) error {
	if info, err := os.Stat(template); err == nil && info.Size() == sizeBytes {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(template), filemode.PrivateDirectory); err != nil {
		return fmt.Errorf("create overlay template directory: %w", err)
	}
	staging := template + ".staging"
	if err := formatOverlayDisk(ctx, staging, sizeBytes); err != nil {
		return errors.Join(err, removeOverlayStaging(staging))
	}
	if err := os.Rename(staging, template); err != nil {
		return errors.Join(fmt.Errorf("install overlay template: %w", err), removeOverlayStaging(staging))
	}
	return nil
}

func formatOverlayDisk(ctx context.Context, path string, sizeBytes int64) error {
	file, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, filemode.PrivateFile)
	if err != nil {
		return fmt.Errorf("create overlay disk: %w", err)
	}
	if err := file.Truncate(sizeBytes); err != nil {
		return errors.Join(
			fmt.Errorf("size overlay disk: %w", err),
			closeFileError(file, "overlay disk"),
		)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close overlay disk: %w", err)
	}
	mkfsPath, err := ext4.MkfsPath()
	if err != nil {
		return fmt.Errorf("prepare overlay filesystem: %w", err)
	}
	output, err := exec.CommandContext(context.WithoutCancel(ctx), mkfsPath, "-q", "-b", "4096", "-F", path).CombinedOutput()
	if err != nil {
		return fmt.Errorf("format overlay ext4 disk: %w", hosttool.Failure(err, string(output)))
	}
	return nil
}

func removeOverlayStaging(path string) error {
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove overlay template staging file: %w", err)
	}
	return nil
}

func growOverlayDisk(ctx context.Context, path string, targetGiB int64) error {
	if path == "" {
		return errors.New("overlay disk path is required")
	}
	targetBytes := align(gibibytes(targetGiB))
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("stat overlay disk: %w", err)
	}
	if targetBytes < info.Size() {
		return fmt.Errorf("target size %d bytes is smaller than current disk size %d bytes", targetBytes, info.Size())
	}
	if targetBytes > info.Size() {
		if err := os.Truncate(path, targetBytes); err != nil {
			return fmt.Errorf("grow overlay disk file: %w", err)
		}
	}
	fsckPath, err := ext4.FsckPath()
	if err != nil {
		return err
	}
	fsckOutput, fsckErr := exec.CommandContext(context.WithoutCancel(ctx), fsckPath, "-f", "-p", path).CombinedOutput()
	if fsckErr != nil {
		var exitError *exec.ExitError
		if !errors.As(fsckErr, &exitError) || exitError.ExitCode() > 1 {
			return fmt.Errorf("check overlay filesystem before growth: %w", hosttool.Failure(fsckErr, string(fsckOutput)))
		}
	}
	resizePath, err := ext4.ResizePath()
	if err != nil {
		return err
	}
	resizeOutput, err := exec.CommandContext(context.WithoutCancel(ctx), resizePath, path).CombinedOutput()
	if err != nil {
		return fmt.Errorf("grow overlay filesystem: %w", hosttool.Failure(err, string(resizeOutput)))
	}
	return nil
}

func gibibytes(value int64) int64 {
	return value * bytesPerGiB
}

func closeFileError(file *os.File, description string) error {
	if err := file.Close(); err != nil {
		return fmt.Errorf("close %s: %w", description, err)
	}
	return nil
}

func align(size int64) int64 {
	if size%sectorSize == 0 {
		return size
	}
	return ((size / sectorSize) + 1) * sectorSize
}
