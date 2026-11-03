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
	"log/slog"
	"net/http"
	"os"

	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/imagecache"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

const (
	platformBundleNotConfiguredCode       = "PLATFORM_BUNDLE_NOT_CONFIGURED"
	platformBundleReferenceMutableCode    = "PLATFORM_BUNDLE_REFERENCE_NOT_IMMUTABLE"
	platformBundlePlatformUnavailableCode = "PLATFORM_BUNDLE_PLATFORM_UNAVAILABLE"
	platformBundleFetchFailedCode         = "PLATFORM_BUNDLE_FETCH_FAILED"
	platformBundleDigestMismatchCode      = "PLATFORM_BUNDLE_DIGEST_MISMATCH"
	platformBundleMountFailedCode         = "PLATFORM_BUNDLE_MOUNT_FAILED"
)

const platformBundlePrefetchOperationID = "platform-prefetch"

func (b *Backend) PreparePlatformBundles(
	ctx context.Context,
	platform string,
	capabilities []guest.SandboxCapability,
) ([]types.PreparedPlatformBundle, error) {
	bundles, err := b.bundlesForCapabilities(capabilities)
	if err != nil {
		return nil, classifyPlatformBundleSelectionError(err)
	}
	prepared := make([]types.PreparedPlatformBundle, 0, len(bundles))
	records := make([]imagecache.ImageRecord, 0, len(bundles))
	for _, bundle := range bundles {
		record, err := b.resolvePlatformBundle(ctx, platformBundlePrefetchOperationID, bundle, platform)
		if err != nil {
			return nil, err
		}
		diskPath := b.paths.ImageDisk(record.Repository, record.DigestHex())
		if err := validatePlatformBundleRecord(bundle, platform, record, diskPath); err != nil {
			return nil, err
		}
		prepared = append(prepared, types.PreparedPlatformBundle{
			Name: bundle.Name, Reference: record.Repository + "@" + record.Digest,
			Digest: record.Digest, Platform: record.Platform, SizeBytes: record.SizeBytes,
			Capabilities: append([]guest.SandboxCapability(nil), bundle.Capabilities...),
		})
		records = append(records, record)
	}
	if err := b.preparePinnedImages(ctx, platform); err != nil {
		return nil, err
	}
	if err := b.releaseStalePlatformBundles(ctx, records); err != nil {
		slog.WarnContext(ctx, "could not release stale platform bundles", "error", err)
	}
	return prepared, nil
}

func (b *Backend) preparePlatformBundles(ctx context.Context, metadata *state.InstanceMetadata, platform string) error {
	bundles, err := b.bundlesForCapabilities(metadata.RawRequest.Capabilities)
	if err != nil {
		return classifyPlatformBundleSelectionError(err)
	}
	for _, bundle := range bundles {
		record, err := b.resolvePlatformBundle(ctx, metadata.ID, bundle, platform)
		if err != nil {
			return err
		}
		diskPath := b.paths.ImageDisk(record.Repository, record.DigestHex())
		if err := validatePlatformBundleRecord(bundle, platform, record, diskPath); err != nil {
			return err
		}
		device, err := virtioBlockDevice(len(metadata.AdditionalDisks) + reservedVirtioDisks)
		if err != nil {
			return fmt.Errorf("assign platform bundle %q device: %w", bundle.Name, err)
		}
		metadata.AdditionalDisks = append(metadata.AdditionalDisks, hypervisor.Disk{Path: diskPath, Readonly: true})
		metadata.PlatformBundles = append(metadata.PlatformBundles, state.PlatformBundleMetadata{
			Name: bundle.Name, Version: bundle.Version, ReleaseDigest: bundle.ReleaseDigest,
			Required:  bundle.Required,
			Reference: record.Repository + "@" + record.Digest,
			Digest:    record.Digest, Platform: record.Platform, DiskPath: diskPath,
			Device: device, Filesystem: guest.FilesystemEROFS, MountPath: bundle.MountPath,
			Capabilities: append([]guest.SandboxCapability(nil), bundle.Capabilities...),
			Components:   append([]guest.Manifest(nil), bundle.Components...),
		})
		for _, component := range bundle.Components {
			metadata.GuestServices = append(metadata.GuestServices, component.Services...)
		}
	}
	return nil
}

func (b *Backend) ensurePersistedPlatformBundles(ctx context.Context, metadata state.InstanceMetadata) error {
	capabilities, err := guest.NormalizeSandboxCapabilities(metadata.RawRequest.Capabilities)
	if err != nil {
		return classifyPlatformBundleSelectionError(err)
	}
	selected, err := b.bundlesForCapabilities(capabilities)
	if err != nil {
		return classifyPlatformBundleSelectionError(err)
	}
	if len(metadata.PlatformBundles) == 0 {
		if len(selected) == 0 {
			return nil
		}
		return mvmerrors.NewWithCause(
			http.StatusServiceUnavailable,
			"sandbox platform bundle metadata is missing",
			platformBundleNotConfiguredCode,
			guest.ErrBundleNotConfigured,
		)
	}
	if len(selected) != len(metadata.PlatformBundles) {
		return platformBundleMetadataError(fmt.Errorf("persisted platform artifact count %d does not match selected count %d", len(metadata.PlatformBundles), len(selected)))
	}
	if len(metadata.AdditionalDisks) != len(metadata.VolumeAttachments)+len(metadata.PlatformBundles) {
		return platformBundleMetadataError(fmt.Errorf("persisted platform disk ordering is invalid"))
	}
	for index, persisted := range metadata.PlatformBundles {
		if err := b.verifyPersistedPlatformBundle(ctx, metadata, index, persisted, selected[index]); err != nil {
			return err
		}
	}
	return nil
}

func (b *Backend) verifyPersistedPlatformBundle(
	ctx context.Context,
	metadata state.InstanceMetadata,
	index int,
	persisted state.PlatformBundleMetadata,
	selected guest.Bundle,
) error {
	if persisted.Name != selected.Name {
		return platformBundleMetadataError(fmt.Errorf("persisted platform artifact %d is %q, selected %q", index, persisted.Name, selected.Name))
	}
	persistedBundle := guest.Bundle{
		Name: persisted.Name, Version: persisted.Version, ReleaseDigest: persisted.ReleaseDigest,
		Required:     persisted.Required,
		Image:        persisted.Reference,
		Capabilities: append([]guest.SandboxCapability(nil), persisted.Capabilities...),
		MountPath:    persisted.MountPath,
		Components:   append([]guest.Manifest(nil), persisted.Components...),
	}
	if err := persistedBundle.Validate(); err != nil {
		return platformBundleMetadataError(err)
	}
	if err := verifyPlatformBundleAttachment(metadata, index, persisted); err != nil {
		return err
	}
	record, err := b.resolvePlatformBundle(ctx, metadata.ID, persistedBundle, persisted.Platform)
	if err != nil {
		return err
	}
	if err := validatePlatformBundleRecord(persistedBundle, persisted.Platform, record, persisted.DiskPath); err != nil {
		return err
	}
	if record.Digest != persisted.Digest {
		return mvmerrors.NewWithCause(
			http.StatusBadGateway,
			fmt.Sprintf("platform bundle %q no longer matches persisted identity", persisted.Name),
			platformBundleDigestMismatchCode,
			fmt.Errorf("persisted digest %s, resolved digest %s", persisted.Digest, record.Digest),
		)
	}
	return nil
}

func verifyPlatformBundleAttachment(metadata state.InstanceMetadata, index int, persisted state.PlatformBundleMetadata) error {
	expectedDevice, err := virtioBlockDevice(len(metadata.VolumeAttachments) + index + reservedVirtioDisks)
	if err != nil {
		return platformBundleMetadataError(err)
	}
	if persisted.Device != expectedDevice || persisted.Filesystem == "" {
		return platformBundleMetadataError(fmt.Errorf("persisted platform mount contract for %q is invalid", persisted.Name))
	}
	platformDisk := metadata.AdditionalDisks[len(metadata.VolumeAttachments)+index]
	if platformDisk.Path != persisted.DiskPath || !platformDisk.Readonly {
		return platformBundleMetadataError(fmt.Errorf("persisted platform disk attachment for %q is invalid", persisted.Name))
	}
	return nil
}

func (b *Backend) preparePinnedImages(ctx context.Context, platform string) error {
	for _, image := range b.pinnedImages {
		if _, err := b.images.Ensure(ctx, image, b.platformBundleRegistry(), platform, types.ImagePullIfNotPresent); err != nil {
			return fmt.Errorf("prepare pinned image %s: %w", image, err)
		}
	}
	return nil
}

func (b *Backend) resolvePlatformBundle(
	ctx context.Context,
	instanceID string,
	bundle guest.Bundle,
	platform string,
) (imagecache.ImageRecord, error) {
	return runLifecycleOperation(
		b,
		instanceID,
		"",
		lifecycle.OperationPlatformBundle,
		func() (imagecache.ImageRecord, error) {
			record, err := b.images.EnsureDiskArtifact(ctx, bundle.Image, b.platformBundleRegistry(), platform)
			if err != nil {
				return imagecache.ImageRecord{}, mvmerrors.NewWithCause(
					http.StatusServiceUnavailable,
					fmt.Sprintf("platform bundle %q could not be resolved", bundle.Name),
					platformBundleFetchFailedCode,
					err,
				)
			}
			return record, nil
		},
	)
}

func platformBundleMetadataError(cause error) error {
	return mvmerrors.NewWithCause(
		http.StatusConflict,
		"sandbox platform bundle mount contract is invalid",
		platformBundleMountFailedCode,
		cause,
	)
}

func classifyPlatformBundleSelectionError(err error) error {
	switch {
	case errors.Is(err, guest.ErrMutableBundleReference):
		return mvmerrors.NewWithCause(
			http.StatusServiceUnavailable,
			"platform bundle must use an immutable digest reference",
			platformBundleReferenceMutableCode,
			err,
		)
	case errors.Is(err, guest.ErrBundleNotConfigured):
		return mvmerrors.NewWithCause(
			http.StatusServiceUnavailable,
			"requested sandbox capabilities are not configured on this machine",
			platformBundleNotConfiguredCode,
			err,
		)
	default:
		return mvmerrors.NewWithCause(
			http.StatusServiceUnavailable,
			"platform bundle configuration is invalid",
			platformBundleNotConfiguredCode,
			err,
		)
	}
}

func validatePlatformBundleRecord(bundle guest.Bundle, requestedPlatform string, record imagecache.ImageRecord, diskPath string) error {
	reference, err := imagecache.ParseImageRef(bundle.Image)
	if err != nil {
		return mvmerrors.NewWithCause(
			http.StatusServiceUnavailable,
			fmt.Sprintf("platform bundle %q has an invalid OCI reference", bundle.Name),
			platformBundleFetchFailedCode,
			err,
		)
	}
	if reference.IsDigest() && reference.Digest() != record.Digest {
		return mvmerrors.NewWithCause(
			http.StatusBadGateway,
			fmt.Sprintf("platform bundle %q resolved to an unexpected digest", bundle.Name),
			platformBundleDigestMismatchCode,
			fmt.Errorf("requested digest %s, resolved digest %s", reference.Digest(), record.Digest),
		)
	}
	requested, err := imagecache.ParsePlatform(requestedPlatform)
	if err != nil {
		return mvmerrors.NewWithCause(
			http.StatusServiceUnavailable,
			fmt.Sprintf("platform bundle %q was requested for an invalid platform", bundle.Name),
			platformBundlePlatformUnavailableCode,
			err,
		)
	}
	resolved, err := imagecache.ParsePlatform(record.Platform)
	if err != nil || !requested.Matches(resolved) {
		if err == nil {
			err = fmt.Errorf("requested platform %s, resolved platform %s", requested, resolved)
		}
		return mvmerrors.NewWithCause(
			http.StatusServiceUnavailable,
			fmt.Sprintf("platform bundle %q is unavailable for %s", bundle.Name, requested),
			platformBundlePlatformUnavailableCode,
			err,
		)
	}
	if record.Status != imagecache.ImageStatusReady {
		return mvmerrors.NewWithCause(
			http.StatusServiceUnavailable,
			fmt.Sprintf("platform bundle %q is not ready", bundle.Name),
			platformBundleFetchFailedCode,
			fmt.Errorf("image status is %q", record.Status),
		)
	}
	info, err := os.Stat(diskPath)
	if err != nil {
		return mvmerrors.NewWithCause(
			http.StatusServiceUnavailable,
			fmt.Sprintf("platform bundle %q disk is unavailable", bundle.Name),
			platformBundleFetchFailedCode,
			err,
		)
	}
	if !info.Mode().IsRegular() {
		return mvmerrors.NewWithCause(
			http.StatusServiceUnavailable,
			fmt.Sprintf("platform bundle %q disk is invalid", bundle.Name),
			platformBundleFetchFailedCode,
			fmt.Errorf("prepared disk %s is not a regular file", diskPath),
		)
	}
	return nil
}
