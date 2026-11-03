// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
package guestrelease

import (
	"errors"
	"fmt"
	"slices"

	v1 "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	registrytypes "github.com/google/go-containerregistry/pkg/v1/types"
)

func (release publisher) publishBenchmark() (v1.Descriptor, error) {
	manifests := make([]v1.Descriptor, 0, len(release.platforms))
	for _, platform := range release.platforms {
		descriptor, err := release.benchmarkImage(platform)
		if err != nil {
			return v1.Descriptor{}, fmt.Errorf("resolve %s benchmark image: %w", platform.suffix, err)
		}
		manifests = append(manifests, descriptor)
	}
	benchmarkManifest := v1.IndexManifest{
		SchemaVersion: ociIndexSchemaVersion,
		MediaType:     registrytypes.OCIImageIndex,
		ArtifactType:  benchmarkArtifactType,
		Manifests:     manifests,
		Annotations: releaseAnnotations(release.cfg, map[string]string{
			componentAnnotation: BenchmarkArtifactName,
		}),
	}
	tag, err := release.tag(BenchmarkArtifactName + "-" + release.cfg.Version)
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("parse benchmark output tag: %w", err)
	}
	descriptor, err := putIndex(tag, benchmarkManifest, release.options)
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("publish benchmark index: %w", err)
	}
	descriptor.Annotations = map[string]string{artifactNameAnnotation: BenchmarkArtifactName}
	return descriptor, nil
}

func (release publisher) benchmarkImage(platform publishPlatform) (v1.Descriptor, error) {
	source, err := release.tag(BenchmarkArtifactName + "-" + release.cfg.Version + "-" + platform.suffix)
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("parse source tag: %w", err)
	}
	image, err := remote.Image(source, slices.Concat(release.options, []remote.Option{remote.WithPlatform(platform.platform)})...)
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("fetch benchmark image: %w", err)
	}
	if mediaType, err := image.MediaType(); err != nil || mediaType != registrytypes.OCIManifestSchema1 {
		return v1.Descriptor{}, errors.Join(fmt.Errorf("benchmark image has media type %q, expected an OCI image manifest", mediaType), err)
	}
	digest, err := image.Digest()
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("read benchmark image digest: %w", err)
	}
	size, err := image.Size()
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("read benchmark image size: %w", err)
	}
	return v1.Descriptor{
		MediaType: registrytypes.OCIManifestSchema1, Size: size, Digest: digest, Platform: &platform.platform,
	}, nil
}
