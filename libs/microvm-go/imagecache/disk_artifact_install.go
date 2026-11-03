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
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strconv"
	"time"

	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/klauspost/compress/zstd"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/types"
)

type diskDescriptor struct {
	layer      gcr.Descriptor
	diskDigest gcr.Hash
	diskSize   int64
}

func (s *ImageStore) EnsureDiskArtifact(ctx context.Context, reference string, registry *types.Registry, platform string) (ImageRecord, error) {
	ref, err := ParseImageRef(reference)
	if err != nil {
		return ImageRecord{}, err
	}
	if !ref.IsDigest() {
		return ImageRecord{}, fmt.Errorf("%w: disk artifact %q must be digest-pinned", ErrInvalidImageRef, reference)
	}
	wanted, err := ResolvePlatform(platform)
	if err != nil {
		return ImageRecord{}, err
	}
	if record, err := s.cachedDigest(ref.Repository(), ref.Digest(), wanted); err == nil {
		return record, nil
	}
	return s.prepareOnce(ctx, preparationKey(ref.Repository(), ref.Digest()), func(ctx context.Context) (ImageRecord, error) {
		if record, err := s.cachedDigest(ref.Repository(), ref.Digest(), wanted); err == nil {
			return record, nil
		}
		return s.installDiskArtifact(ctx, ref, registry, wanted)
	})
}

func (s *ImageStore) installDiskArtifact(ctx context.Context, ref ImageRef, registry *types.Registry, platform Platform) (ImageRecord, error) {
	startedAt := time.Now()
	registryRef, err := parseRegistryReference(ref.String(), registry)
	if err != nil {
		return ImageRecord{}, fmt.Errorf("%w: parse disk artifact reference: %w", ErrInvalidImageRef, err)
	}
	artifact, err := remote.Image(registryRef, remoteOptions(ctx, registry, platform, registryAuthenticationAnonymous)...)
	if err != nil {
		return ImageRecord{}, fmt.Errorf("fetch disk artifact %s: %w", ref, err)
	}
	descriptor, err := validateDiskArtifact(artifact, ref.Digest())
	if err != nil {
		return ImageRecord{}, fmt.Errorf("disk artifact %s: %w", ref, err)
	}
	layer, err := artifact.LayerByDigest(descriptor.layer.Digest)
	if err != nil {
		return ImageRecord{}, fmt.Errorf("read disk artifact layer: %w", err)
	}
	diskPath := s.paths.ImageDisk(ref.Repository(), ref.DigestHex())
	diskSize, err := installDisk(diskPath, func(temporaryPath string) (int64, error) {
		return writeDiskLayer(layer, descriptor, temporaryPath)
	})
	if err != nil {
		return ImageRecord{}, fmt.Errorf("install disk artifact %s: %w", ref, err)
	}
	now := time.Now().UTC()
	record := ImageRecord{
		Reference: ref.String(), Repository: ref.Repository(), Digest: ref.Digest(),
		Platform: platform.String(), Status: ImageStatusReady, Source: ImageSourceDiskArtifact, SizeBytes: diskSize,
		CreatedAt: now, UpdatedAt: now,
	}
	if err := s.Write(record); err != nil {
		return ImageRecord{}, err
	}
	slog.InfoContext(
		ctx,
		"disk artifact installed",
		"reference", record.Reference,
		"compressed_bytes", descriptor.layer.Size,
		"disk_bytes", diskSize,
		"total_ms", time.Since(startedAt).Milliseconds(),
	)
	return record, nil
}

func validateDiskArtifact(artifact gcr.Image, expectedDigest string) (diskDescriptor, error) {
	digest, err := artifact.Digest()
	if err != nil {
		return diskDescriptor{}, fmt.Errorf("read digest: %w", err)
	}
	if digest.String() != expectedDigest {
		return diskDescriptor{}, fmt.Errorf("registry returned digest %s", digest)
	}
	manifest, err := artifact.Manifest()
	if err != nil {
		return diskDescriptor{}, fmt.Errorf("read manifest: %w", err)
	}
	if manifest.ArtifactType != DiskArtifactType || manifest.Config.MediaType != emptyConfigMediaType {
		return diskDescriptor{}, fmt.Errorf("artifact type %q is not %q", manifest.ArtifactType, DiskArtifactType)
	}
	if len(manifest.Layers) != 1 || manifest.Layers[0].MediaType != DiskLayerMediaType {
		return diskDescriptor{}, fmt.Errorf("artifact must hold exactly one %s layer", DiskLayerMediaType)
	}
	layer := manifest.Layers[0]
	diskDigest, err := gcr.NewHash(layer.Annotations[diskDigestAnnotation])
	if err != nil || diskDigest.Algorithm != sha256Algorithm {
		return diskDescriptor{}, errors.Join(errors.New("filesystem digest annotation is invalid"), err)
	}
	diskSize, err := strconv.ParseInt(layer.Annotations[diskSizeAnnotation], 10, 64)
	if err != nil || diskSize <= 0 {
		return diskDescriptor{}, errors.Join(errors.New("filesystem size annotation is invalid"), err)
	}
	return diskDescriptor{layer: layer, diskDigest: diskDigest, diskSize: diskSize}, nil
}

func writeDiskLayer(layer gcr.Layer, descriptor diskDescriptor, diskPath string) (written int64, resultErr error) {
	compressed, err := layer.Compressed()
	if err != nil {
		return 0, fmt.Errorf("download filesystem layer: %w", err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, wrapCloseError("close filesystem layer", compressed.Close()))
	}()
	decoder, err := zstd.NewReader(compressed, zstd.WithDecoderConcurrency(1))
	if err != nil {
		return 0, fmt.Errorf("open zstd filesystem layer: %w", err)
	}
	defer decoder.Close()
	target, err := os.OpenFile(diskPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, filemode.SharedFile)
	if err != nil {
		return 0, fmt.Errorf("create filesystem: %w", err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, wrapCloseError("close filesystem", target.Close()))
	}()
	hash := sha256.New()
	written, err = io.Copy(io.MultiWriter(target, hash), io.LimitReader(decoder, descriptor.diskSize+1))
	if err != nil {
		return 0, fmt.Errorf("decompress filesystem: %w", err)
	}
	if written != descriptor.diskSize {
		return 0, fmt.Errorf("filesystem is %d bytes, expected %d", written, descriptor.diskSize)
	}
	if actual := sha256Hash(hash.Sum(nil)); actual != descriptor.diskDigest {
		return 0, fmt.Errorf("filesystem digest is %s, expected %s", actual, descriptor.diskDigest)
	}
	if _, err := io.Copy(io.Discard, compressed); err != nil {
		return 0, fmt.Errorf("verify filesystem layer: %w", err)
	}
	return written, nil
}
