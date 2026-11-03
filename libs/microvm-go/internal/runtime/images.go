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
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/imagecache"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/snapshot"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

const (
	imageExportDirectoryMode = 0o755
	exportResumeTimeout      = 30 * time.Second
)

func (b *Backend) ExportInstanceImage(ctx context.Context, instanceID string, request types.ExportImageRequest) (types.ImageInfo, error) {
	target := request.Reference
	if target == "" {
		target = request.Repository
	}
	return runLifecycleOperation(b, instanceID, target, lifecycle.OperationExportImage, func() (types.ImageInfo, error) {
		guard, err := b.lockInstanceMutation(ctx, instanceID)
		if err != nil {
			return types.ImageInfo{}, fmt.Errorf("acquire instance lifecycle lock: %w", err)
		}
		defer guard.Release()
		return b.exportInstanceImageLocked(ctx, instanceID, request)
	})
}

func (b *Backend) exportInstanceImageLocked(ctx context.Context, instanceID string, request types.ExportImageRequest) (result types.ImageInfo, returnErr error) {
	if request.Registry == nil {
		return types.ImageInfo{}, mvmerrors.NewInvalidRequest(errors.New("export registry is required"))
	}
	reference, err := exportImageReference(request)
	if err != nil {
		return types.ImageInfo{}, mvmerrors.NewInvalidRequest(err)
	}

	metadata, err := b.readInstance(instanceID)
	if err != nil {
		return types.ImageInfo{}, err
	}
	if err := validateRequestedTransition(lifecycle.OperationExportImage, metadata.State); err != nil {
		return types.ImageInfo{}, err
	}
	exportMetadata, cleanup, err := b.exportImageMetadata(ctx, metadata, request.Source)
	if err != nil {
		return types.ImageInfo{}, err
	}
	defer func() {
		if cleanupErr := cleanup(); cleanupErr != nil {
			returnErr = errors.Join(returnErr, cleanupErr)
		}
	}()
	if strings.TrimSpace(metadata.ResolvedImage) == "" {
		return types.ImageInfo{}, fmt.Errorf("instance %s has no resolved source image", instanceID)
	}
	record, err := b.images.ReadReference(metadata.ResolvedImage)
	if err != nil {
		return types.ImageInfo{}, fmt.Errorf("read source image metadata: %w", err)
	}
	workDir, err := b.createImageExportWorkspace(instanceID)
	if err != nil {
		return types.ImageInfo{}, err
	}
	defer func() {
		if cleanupErr := os.RemoveAll(workDir); cleanupErr != nil {
			returnErr = errors.Join(returnErr, fmt.Errorf("remove image export workspace %s: %w", workDir, cleanupErr))
		}
	}()

	image, err := snapshot.ExportStoppedImage(ctx, exportMetadata, record, workDir)
	if err != nil {
		return types.ImageInfo{}, fmt.Errorf("export stopped instance root filesystem: %w", err)
	}
	return pushExportedImage(ctx, image, reference, request)
}

func (b *Backend) createImageExportWorkspace(instanceID string) (string, error) {
	if err := os.MkdirAll(b.paths.SystemBuildsDir(), imageExportDirectoryMode); err != nil {
		return "", fmt.Errorf("create image export directory: %w", err)
	}
	workDir, err := os.MkdirTemp(b.paths.SystemBuildsDir(), "export-"+instanceID+"-*")
	if err != nil {
		return "", fmt.Errorf("create image export workspace: %w", err)
	}
	return workDir, nil
}

func exportedImageReference(image imagecache.Image, reference string, request types.ExportImageRequest) (imagecache.ImageRef, error) {
	digest, err := image.Digest()
	if err != nil {
		return imagecache.ImageRef{}, fmt.Errorf("compute exported image digest: %w", err)
	}
	if reference == "" {
		digestID := strings.TrimPrefix(digest.String(), "sha256:")
		if digestID == "" {
			return imagecache.ImageRef{}, errors.New("exported image digest is empty")
		}
		reference = fmt.Sprintf(
			"%s/%s%s:%s",
			strings.TrimSuffix(strings.TrimSpace(request.Repository), "/"),
			request.NamePrefix,
			digestID,
			strings.TrimSpace(request.Tag),
		)
	}
	parsedReference, err := imagecache.ParseImageRef(reference)
	if err != nil {
		return imagecache.ImageRef{}, fmt.Errorf("validate exported image reference: %w", err)
	}
	if parsedReference.IsDigest() {
		return imagecache.ImageRef{}, errors.New("exported image reference must use a tag")
	}
	return parsedReference, nil
}

func pushExportedImage(ctx context.Context, image imagecache.Image, reference string, request types.ExportImageRequest) (types.ImageInfo, error) {
	parsedReference, err := exportedImageReference(image, reference, request)
	if err != nil {
		return types.ImageInfo{}, err
	}
	if err := imagecache.Push(ctx, image, parsedReference.String(), request.Registry); err != nil {
		return types.ImageInfo{}, err
	}
	imageMetadata, err := imagecache.MetadataFromImage(parsedReference.String(), parsedReference.Repository(), image)
	if err != nil {
		return types.ImageInfo{}, err
	}
	return types.ImageInfo{
		Reference:  imageMetadata.Reference,
		Repository: imageMetadata.Repository,
		Digest:     imageMetadata.Digest,
		Platform:   imageMetadata.Platform.String(),
		Entrypoint: append([]string(nil), imageMetadata.Entrypoint...),
		Command:    append([]string(nil), imageMetadata.Cmd...),
		SizeBytes:  imageMetadata.SizeBytes,
	}, nil
}

func exportImageReference(request types.ExportImageRequest) (string, error) {
	reference := strings.TrimSpace(request.Reference)
	repository := strings.TrimSpace(request.Repository)
	tag := strings.TrimSpace(request.Tag)
	if reference != "" {
		if repository != "" || tag != "" || request.NamePrefix != "" {
			return "", errors.New("exact export reference cannot be combined with repository naming")
		}
		parsed, err := imagecache.ParseImageRef(reference)
		if err != nil {
			return "", fmt.Errorf("validate exact export reference: %w", err)
		}
		if parsed.IsDigest() {
			return "", errors.New("exact export reference must use a tag")
		}
		return parsed.String(), nil
	}
	if repository == "" {
		return "", errors.New("export repository is required")
	}
	if tag == "" {
		return "", errors.New("export image tag is required")
	}
	return "", nil
}

func (b *Backend) exportImageMetadata(
	ctx context.Context,
	metadata state.InstanceMetadata,
	source types.ExportImageSource,
) (state.InstanceMetadata, func() error, error) {
	if source == "" {
		source = types.ExportImageSourceStopped
	}
	switch source {
	case types.ExportImageSourceStopped:
		if metadata.State != types.RuntimeStateStopped {
			return state.InstanceMetadata{}, nil, stateConflict(
				"stopped image export requires a stopped instance",
				"MICROVM_EXPORT_REQUIRES_STOPPED_STATE",
			)
		}
		return metadata, func() error { return nil }, nil
	case types.ExportImageSourceQuiesced:
		if metadata.State == types.RuntimeStateStopped {
			return metadata, func() error { return nil }, nil
		}
		if metadata.State != types.RuntimeStateStarted || !b.processRunning(ctx, metadata) {
			return state.InstanceMetadata{}, nil, stateConflict(
				"quiesced image export requires a running or stopped instance",
				"MICROVM_EXPORT_REQUIRES_ACTIVE_STATE",
			)
		}
		if metadata.GPUQuota > 0 || len(metadata.GPUAssignments) > 0 {
			return state.InstanceMetadata{}, nil, mvmerrors.NewInvalidRequest(
				errors.New("quiesced image export does not support an attached GPU"),
			)
		}
		return b.captureQuiescedExportMetadata(ctx, metadata)
	default:
		return state.InstanceMetadata{}, nil, mvmerrors.NewInvalidRequest(
			fmt.Errorf("unsupported export image source %q", source),
		)
	}
}

func (b *Backend) captureQuiescedExportMetadata(
	ctx context.Context,
	metadata state.InstanceMetadata,
) (state.InstanceMetadata, func() error, error) {
	if err := b.quiesceGuestForSnapshot(ctx, &metadata); err != nil {
		return state.InstanceMetadata{}, nil, err
	}
	if err := b.pauseVM(ctx, metadata); err != nil {
		recoveryErr := b.recoverQuiescedSnapshotSource(context.WithoutCancel(ctx), &metadata)
		return state.InstanceMetadata{}, nil, errors.Join(err, recoveryErr)
	}
	if err := b.persistSnapshotPause(&metadata); err != nil {
		resumeErr := b.resumeSnapshotSource(context.WithoutCancel(ctx), &metadata)
		return state.InstanceMetadata{}, nil, errors.Join(err, resumeErr)
	}

	snapshotID := uuid.NewString()
	_, snapshotErr := b.snapshots.CreateStoppedWithID(snapshotID, metadata, "portable-export")
	resumeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), exportResumeTimeout)
	resumeErr := b.resumeSnapshotSource(resumeCtx, &metadata)
	cancel()
	if snapshotErr != nil || resumeErr != nil {
		cleanupErr := b.deleteTemporaryExportSnapshot(snapshotID)
		return state.InstanceMetadata{}, nil, errors.Join(snapshotErr, resumeErr, cleanupErr)
	}

	exportMetadata := metadata
	exportMetadata.OverlayDisk = filepath.Join(b.paths.SnapshotPayloadDir(snapshotID), "overlay.raw")
	cleanup := func() error {
		return b.deleteTemporaryExportSnapshot(snapshotID)
	}
	return exportMetadata, cleanup, nil
}

func (b *Backend) deleteTemporaryExportSnapshot(snapshotID string) error {
	err := b.snapshots.Delete(snapshotID)
	if err == nil || errors.Is(err, snapshot.ErrNotFound) {
		return nil
	}
	return fmt.Errorf("delete temporary export snapshot %s: %w", snapshotID, err)
}

func (b *Backend) PullImage(ctx context.Context, imageName string, registryDTO *types.Registry, platform string) error {
	defer b.requestSupportDiskSample()
	_, err := b.images.Materialize(ctx, imageName, registryDTO, platform)
	return err
}

func (b *Backend) BuildImage(ctx context.Context, request types.BuildRequest) error {
	defer b.requestSupportDiskSample()
	_, err := b.builds.Build(ctx, request)
	return err
}

func (b *Backend) TagImage(ctx context.Context, imageName, tag string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	return b.images.Tag(imageName, tag)
}

func (b *Backend) PushImage(ctx context.Context, tag string, registryDTO *types.Registry) error {
	_, image, err := b.images.LoadImage(tag)
	if err != nil {
		return err
	}
	return imagecache.Push(ctx, image, tag, registryDTO)
}

func (b *Backend) RemoveImage(ctx context.Context, imageName string) error {
	defer b.requestSupportDiskSample()
	if err := ctx.Err(); err != nil {
		return err
	}
	record, err := b.images.ReadReference(imageName)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if err := b.images.Remove(imageName); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	protected, err := b.protectedImageDirs()
	if err != nil {
		return fmt.Errorf("find images held by runtimes: %w", err)
	}
	if err := b.images.Release(ctx, record, protected); err != nil {
		return fmt.Errorf("release image %s: %w", imageName, err)
	}
	return nil
}

func (b *Backend) ImageInfo(ctx context.Context, imageName string) (types.ImageInfo, error) {
	if err := ctx.Err(); err != nil {
		return types.ImageInfo{}, err
	}
	record, err := b.images.ReadReference(imageName)
	if err != nil {
		return types.ImageInfo{}, err
	}
	return imageInfoFromRecord(record), nil
}

func (b *Backend) InspectImage(ctx context.Context, imageName string, registry *types.Registry, platform string) (types.ImageInfo, error) {
	record, err := b.images.Resolve(ctx, imageName, registry, platform)
	if err != nil {
		return types.ImageInfo{}, err
	}
	return imageInfoFromRecord(record), nil
}

func imageInfoFromRecord(record imagecache.ImageRecord) types.ImageInfo {
	return types.ImageInfo{
		Reference:  record.Reference,
		Repository: record.Repository,
		Digest:     record.Digest,
		Platform:   record.Platform,
		Entrypoint: append([]string(nil), record.Entrypoint...),
		Command:    append([]string(nil), record.Cmd...),
		SizeBytes:  record.SizeBytes,
	}
}
