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
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/snapflowio/microvm-go/internal/filemode"
)

func preparationKey(repository, digest string) string {
	return repository + "@" + digest
}

func (s *ImageStore) prepareOnce(ctx context.Context, key string, prepare func(context.Context) (ImageRecord, error)) (ImageRecord, error) {
	results := s.flights.DoChan(key, func() (any, error) {
		select {
		case s.slots <- struct{}{}:
		case <-ctx.Done():
			return ImageRecord{}, fmt.Errorf("wait to prepare image: %w", ctx.Err())
		}
		defer func() { <-s.slots }()
		s.releases.RLock()
		defer s.releases.RUnlock()
		return prepare(ctx)
	})
	select {
	case <-ctx.Done():
		return ImageRecord{}, fmt.Errorf("wait to prepare image: %w", ctx.Err())
	case result := <-results:
		if result.Err != nil {
			return ImageRecord{}, result.Err
		}
		record, ok := result.Val.(ImageRecord)
		if !ok {
			return ImageRecord{}, errors.New("image preparation returned an unexpected result")
		}
		return record, nil
	}
}

func (s *ImageStore) materializeResolved(ctx context.Context, metadata ImageMetadata, image Image) (ImageRecord, error) {
	record, err := s.cachedDigest(metadata.Repository, metadata.Digest, metadata.Platform)
	if err != nil {
		record, err = s.prepareOnce(ctx, preparationKey(metadata.Repository, metadata.Digest), func(ctx context.Context) (ImageRecord, error) {
			if cached, cacheErr := s.cachedDigest(metadata.Repository, metadata.Digest, metadata.Platform); cacheErr == nil {
				return cached, nil
			}
			return s.prepareImage(ctx, metadata, image)
		})
		if err != nil {
			return ImageRecord{}, err
		}
	}
	if err := s.linkReference(metadata.Reference, record); err != nil {
		return ImageRecord{}, err
	}
	return record, nil
}

func (s *ImageStore) prepareImage(ctx context.Context, metadata ImageMetadata, image Image) (record ImageRecord, resultErr error) {
	startedAt := time.Now()
	layoutTag := digestHex(metadata.Digest)
	if err := s.layout.PullImage(ctx, image, layoutTag); err != nil {
		return ImageRecord{}, err
	}
	fetchDuration := time.Since(startedAt)
	cached, err := s.layout.Image(layoutTag)
	if err != nil {
		return ImageRecord{}, err
	}
	if err := os.MkdirAll(s.paths.SystemBuildsDir(), filemode.SharedDirectory); err != nil {
		return ImageRecord{}, fmt.Errorf("create image build directory: %w", err)
	}
	workDir, err := os.MkdirTemp(s.paths.SystemBuildsDir(), layoutTag+"-*")
	if err != nil {
		return ImageRecord{}, fmt.Errorf("create isolated image build directory: %w", err)
	}
	defer func() {
		if err := os.RemoveAll(workDir); err != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove image build directory: %w", err))
		}
	}()
	diskPath := s.paths.ImageDisk(metadata.Repository, layoutTag)
	conversion, err := installDisk(diskPath, func(temporaryPath string) (ConversionReport, error) {
		return s.formatter.Convert(ctx, ConvertRequest{
			Image: cached, DiskPath: temporaryPath, WorkDir: workDir, Identity: metadata.Digest,
		})
	})
	if err != nil {
		return ImageRecord{}, fmt.Errorf("convert image %s to EROFS: %w", metadata.Reference, err)
	}
	record = recordFromMetadata(metadata, ImageStatusReady, conversion.DiskBytes)
	if err := s.Write(record); err != nil {
		return ImageRecord{}, err
	}
	logPreparation(ctx, metadata, fetchDuration, conversion, time.Since(startedAt))
	return record, nil
}

func installDisk[T any](diskPath string, write func(temporaryPath string) (T, error)) (result T, resultErr error) {
	if err := os.MkdirAll(filepath.Dir(diskPath), filemode.SharedDirectory); err != nil {
		return result, fmt.Errorf("create prepared image directory: %w", err)
	}
	temporaryPath, err := reserveTemporaryPath(filepath.Dir(diskPath), ".rootfs-*")
	if err != nil {
		return result, err
	}
	defer func() {
		if err := os.Remove(temporaryPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove temporary rootfs disk: %w", err))
		}
	}()
	written, err := write(temporaryPath)
	if err != nil {
		return result, err
	}
	if err := os.Rename(temporaryPath, diskPath); err != nil {
		return result, fmt.Errorf("install prepared rootfs disk: %w", err)
	}
	return written, nil
}

func logPreparation(ctx context.Context, metadata ImageMetadata, fetch time.Duration, conversion ConversionReport, total time.Duration) {
	var compressed, uncompressed int64
	for index, layer := range conversion.Layers {
		compressed += layer.CompressedBytes
		uncompressed += layer.UncompressedBytes
		slog.InfoContext(
			ctx,
			"image layer converted",
			"digest", metadata.Digest,
			"layer_index", index,
			"layer_digest", layer.Digest,
			"media_type", layer.MediaType,
			"compressed_bytes", layer.CompressedBytes,
			"uncompressed_bytes", layer.UncompressedBytes,
			"convert_ms", layer.Duration.Milliseconds(),
		)
	}
	slog.InfoContext(
		ctx,
		"image prepared",
		"reference", metadata.Reference,
		"digest", metadata.Digest,
		"layers", len(conversion.Layers),
		"compressed_bytes", compressed,
		"uncompressed_bytes", uncompressed,
		"disk_bytes", conversion.DiskBytes,
		"fetch_ms", fetch.Milliseconds(),
		"convert_ms", conversion.StreamDuration.Milliseconds(),
		"merge_ms", conversion.MergeDuration.Milliseconds(),
		"total_ms", total.Milliseconds(),
	)
}
