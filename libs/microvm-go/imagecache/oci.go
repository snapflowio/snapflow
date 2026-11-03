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
	"fmt"

	"github.com/google/go-containerregistry/pkg/authn"
	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/snapflowio/microvm-go/types"
)

type Image = gcr.Image

type registryAuthentication uint8

const (
	registryAuthenticationDefault registryAuthentication = iota
	registryAuthenticationAnonymous
)

type ImageMetadata struct {
	Reference  string
	Repository string
	Digest     string
	Platform   Platform
	Entrypoint []string
	Cmd        []string
	Env        map[string]string
	Labels     map[string]string
	WorkingDir string
	SizeBytes  int64
}

func InspectImage(ctx context.Context, imageRef string, registry *types.Registry, requestedPlatform string) (ImageMetadata, error) {
	metadata, image, err := FetchImage(ctx, imageRef, registry, requestedPlatform)
	if err != nil {
		return ImageMetadata{}, err
	}
	if image == nil {
		return ImageMetadata{}, fmt.Errorf("fetched image has no image payload")
	}
	return metadata, nil
}

func FetchImage(ctx context.Context, imageRef string, registry *types.Registry, requestedPlatform string) (ImageMetadata, gcr.Image, error) {
	normalized, err := ParseImageRef(imageRef)
	if err != nil {
		return ImageMetadata{}, nil, err
	}

	platform, err := ResolvePlatform(requestedPlatform)
	if err != nil {
		return ImageMetadata{}, nil, err
	}

	ref, err := parseRegistryReference(normalized.String(), registry)
	if err != nil {
		return ImageMetadata{}, nil, fmt.Errorf("%w: parse image reference: %w", ErrInvalidImageRef, err)
	}

	image, err := remote.Image(ref, remoteOptions(ctx, registry, platform, registryAuthenticationDefault)...)
	if err != nil {
		return ImageMetadata{}, nil, fmt.Errorf("fetch image manifest for %s on %s: %w", normalized.String(), platform, err)
	}

	config, err := image.ConfigFile()
	if err != nil {
		return ImageMetadata{}, nil, fmt.Errorf("read image config for %s: %w", normalized.String(), err)
	}
	digest, err := image.Digest()
	if err != nil {
		return ImageMetadata{}, nil, fmt.Errorf("read image digest for %s: %w", normalized.String(), err)
	}
	manifest, err := image.Manifest()
	if err != nil {
		return ImageMetadata{}, nil, fmt.Errorf("read image manifest for %s: %w", normalized.String(), err)
	}

	actualPlatform := Platform{
		OS:           config.OS,
		Architecture: config.Architecture,
		Variant:      config.Variant,
	}.Normalize()
	if err := actualPlatform.Validate(); err != nil {
		return ImageMetadata{}, nil, fmt.Errorf("image platform: %w", err)
	}
	if !platform.Matches(actualPlatform) {
		return ImageMetadata{}, nil, fmt.Errorf("%w: requested %s but manifest is %s", ErrInvalidPlatform, platform, actualPlatform)
	}

	return ImageMetadata{
		Reference:  normalized.String(),
		Repository: normalized.Repository(),
		Digest:     digest.String(),
		Platform:   actualPlatform,
		Entrypoint: append([]string(nil), config.Config.Entrypoint...),
		Cmd:        append([]string(nil), config.Config.Cmd...),
		Env:        envSliceToMap(config.Config.Env),
		Labels:     cloneStringMap(config.Config.Labels),
		WorkingDir: config.Config.WorkingDir,
		SizeBytes:  imageSizeBytes(manifest),
	}, image, nil
}

func MetadataFromImage(reference, repository string, image gcr.Image) (ImageMetadata, error) {
	config, err := image.ConfigFile()
	if err != nil {
		return ImageMetadata{}, fmt.Errorf("read image config for %s: %w", reference, err)
	}
	digest, err := image.Digest()
	if err != nil {
		return ImageMetadata{}, fmt.Errorf("read image digest for %s: %w", reference, err)
	}
	manifest, err := image.Manifest()
	if err != nil {
		return ImageMetadata{}, fmt.Errorf("read image manifest for %s: %w", reference, err)
	}
	platform := Platform{
		OS:           config.OS,
		Architecture: config.Architecture,
		Variant:      config.Variant,
	}.Normalize()
	if err := platform.Validate(); err != nil {
		return ImageMetadata{}, fmt.Errorf("image platform: %w", err)
	}
	return ImageMetadata{
		Reference:  reference,
		Repository: repository,
		Digest:     digest.String(),
		Platform:   platform,
		Entrypoint: append([]string(nil), config.Config.Entrypoint...),
		Cmd:        append([]string(nil), config.Config.Cmd...),
		Env:        envSliceToMap(config.Config.Env),
		Labels:     cloneStringMap(config.Config.Labels),
		WorkingDir: config.Config.WorkingDir,
		SizeBytes:  imageSizeBytes(manifest),
	}, nil
}

func remoteOptions(ctx context.Context, registry *types.Registry, platform Platform, authentication registryAuthentication) []remote.Option {
	options := []remote.Option{
		remote.WithContext(ctx),
		remote.WithPlatform(gcr.Platform{
			OS:           platform.OS,
			Architecture: platform.Architecture,
			Variant:      platform.Variant,
		}),
	}

	if authentication == registryAuthenticationAnonymous {
		options = append(options, remote.WithAuth(authn.Anonymous))
	} else if registry != nil && (registry.Username != "" || registry.Password != "") {
		options = append(options, remote.WithAuth(authn.FromConfig(authn.AuthConfig{
			Username: registry.Username,
			Password: registry.Password,
		})))
	} else {
		options = append(options, remote.WithAuthFromKeychain(authn.DefaultKeychain))
	}

	return options
}

func envSliceToMap(values []string) map[string]string {
	if len(values) == 0 {
		return nil
	}

	env := make(map[string]string, len(values))
	for _, value := range values {
		for i := 0; i < len(value); i++ {
			if value[i] == '=' {
				env[value[:i]] = value[i+1:]
				break
			}
		}
	}
	return env
}

func cloneStringMap(values map[string]string) map[string]string {
	if len(values) == 0 {
		return nil
	}
	cloned := make(map[string]string, len(values))
	for key, value := range values {
		cloned[key] = value
	}
	return cloned
}

func imageSizeBytes(manifest *gcr.Manifest) int64 {
	if manifest == nil {
		return 0
	}
	total := manifest.Config.Size
	for _, layer := range manifest.Layers {
		total += layer.Size
	}
	return total
}
