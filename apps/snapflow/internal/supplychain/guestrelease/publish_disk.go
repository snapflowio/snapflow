// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package guestrelease

import (
	"context"
	"errors"
	"fmt"
	"os"
	"slices"

	v1 "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	registrytypes "github.com/google/go-containerregistry/pkg/v1/types"
	"github.com/snapflowio/microvm-go/imagecache"
)

const (
	diskTagSuffix      = "-disk"
	diskWorkDirPattern = "snapflow-guest-disk-*"
)

func (release publisher) publishDisk(ctx context.Context, component string, platform publishPlatform) (descriptor v1.Descriptor, resultErr error) {
	imageTag := component + "-" + release.cfg.Version + "-" + platform.suffix
	source, err := release.tag(imageTag)
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("parse source tag: %w", err)
	}
	image, err := remote.Image(source, slices.Concat(release.options, []remote.Option{remote.WithPlatform(platform.platform)})...)
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("fetch component image: %w", err)
	}
	if mediaType, err := image.MediaType(); err != nil || mediaType != registrytypes.OCIManifestSchema1 {
		return v1.Descriptor{}, errors.Join(fmt.Errorf("component image has media type %q, expected an OCI image manifest", mediaType), err)
	}
	workDir, err := os.MkdirTemp("", diskWorkDirPattern)
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("create disk build directory: %w", err)
	}
	defer func() {
		if err := os.RemoveAll(workDir); err != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove disk build directory: %w", err))
		}
	}()
	artifact, err := release.formatter.BuildDiskArtifact(ctx, imagecache.DiskArtifactRequest{Source: image, WorkDir: workDir})
	if err != nil {
		return v1.Descriptor{}, err
	}
	target, err := release.tag(imageTag + diskTagSuffix)
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("parse disk artifact tag: %w", err)
	}
	if err := remote.Write(target, artifact, release.options...); err != nil {
		return v1.Descriptor{}, fmt.Errorf("push disk artifact: %w", err)
	}
	digest, err := artifact.Digest()
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("read disk artifact digest: %w", err)
	}
	size, err := artifact.Size()
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("read disk artifact size: %w", err)
	}
	return v1.Descriptor{
		MediaType: registrytypes.OCIManifestSchema1, ArtifactType: imagecache.DiskArtifactType,
		Size: size, Digest: digest, Platform: &platform.platform,
	}, nil
}
