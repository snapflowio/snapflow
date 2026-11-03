// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package guestrelease

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/go-containerregistry/pkg/authn"
	"github.com/google/go-containerregistry/pkg/name"
	v1 "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	registrytypes "github.com/google/go-containerregistry/pkg/v1/types"
	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/imagecache"
)

type publishPlatform struct {
	platform v1.Platform
	suffix   string
}

func publishedPlatforms() []publishPlatform {
	return []publishPlatform{
		{platform: v1.Platform{OS: "linux", Architecture: "amd64"}, suffix: "amd64"},
		{platform: v1.Platform{OS: "linux", Architecture: "arm64"}, suffix: "arm64"},
	}
}

type PublishConfig struct {
	Repository string
	Version    string
	Revision   string
	Platforms  string
	Desktop    bool
	Insecure   bool
	MkfsErofs  string
}

type PublishResult struct {
	Reference string
}

type rawIndex struct {
	manifest []byte
}

func (index rawIndex) RawManifest() ([]byte, error) {
	return bytes.Clone(index.manifest), nil
}

func (rawIndex) MediaType() (registrytypes.MediaType, error) {
	return registrytypes.OCIImageIndex, nil
}

type publisher struct {
	cfg         PublishConfig
	repository  name.Repository
	nameOptions []name.Option
	options     []remote.Option
	platforms   []publishPlatform
	formatter   *imagecache.ErofsFormatter
}

// publishAuth publishes anonymously to an insecure registry: that is the local development registry,
// which takes no credentials, so an editor's Docker credential helper cannot break development builds.
func publishAuth(insecure bool) remote.Option {
	if insecure {
		return remote.WithAuth(authn.Anonymous)
	}
	return remote.WithAuthFromKeychain(authn.DefaultKeychain)
}

func Publish(ctx context.Context, cfg PublishConfig) (PublishResult, error) {
	cfg.Repository = strings.TrimSpace(cfg.Repository)
	cfg.Version = strings.TrimPrefix(strings.TrimSpace(cfg.Version), "v")
	cfg.Revision = strings.TrimSpace(cfg.Revision)
	cfg.Platforms = strings.TrimSpace(cfg.Platforms)
	if cfg.Repository == "" || cfg.Version == "" || cfg.Revision == "" {
		return PublishResult{}, errors.New("repository, version, and revision are required")
	}
	nameOptions := []name.Option{name.StrictValidation}
	if cfg.Insecure {
		nameOptions = append(nameOptions, name.Insecure)
	}
	repository, err := name.NewRepository(cfg.Repository, nameOptions...)
	if err != nil {
		return PublishResult{}, fmt.Errorf("parse guest release repository: %w", err)
	}
	platforms, err := selectedPublishPlatforms(cfg.Platforms)
	if err != nil {
		return PublishResult{}, err
	}
	formatter, err := imagecache.NewErofsFormatter(imagecache.ErofsFormatterConfig{Path: cfg.MkfsErofs})
	if err != nil {
		return PublishResult{}, fmt.Errorf("configure guest disk formatter: %w", err)
	}
	release := publisher{
		cfg: cfg, repository: repository, nameOptions: nameOptions, platforms: platforms, formatter: formatter,
		options: []remote.Option{remote.WithContext(ctx), publishAuth(cfg.Insecure)},
	}
	components := []string{guestspec.CoreArtifactName}
	if cfg.Desktop {
		components = append(components, guestspec.DesktopArtifactName)
	}
	componentDescriptors := make([]v1.Descriptor, 0, len(components))
	for _, component := range components {
		descriptor, err := release.publishComponent(ctx, component)
		if err != nil {
			return PublishResult{}, err
		}
		componentDescriptors = append(componentDescriptors, descriptor)
	}
	benchmarkDescriptor, err := release.publishBenchmark()
	if err != nil {
		return PublishResult{}, err
	}
	componentDescriptors = append(componentDescriptors, benchmarkDescriptor)
	releaseManifest := v1.IndexManifest{
		SchemaVersion: ociIndexSchemaVersion,
		MediaType:     registrytypes.OCIImageIndex,
		ArtifactType:  releaseArtifactType,
		Manifests:     componentDescriptors,
		Annotations: releaseAnnotations(cfg, map[string]string{
			schemaAnnotation: indexSchema,
		}),
	}
	releaseTag, err := release.tag(cfg.Version)
	if err != nil {
		return PublishResult{}, fmt.Errorf("parse release output tag: %w", err)
	}
	descriptor, err := putIndex(releaseTag, releaseManifest, release.options)
	if err != nil {
		return PublishResult{}, fmt.Errorf("publish guest release index: %w", err)
	}
	return PublishResult{Reference: repository.Name() + "@" + descriptor.Digest.String()}, nil
}

func (release publisher) publishComponent(ctx context.Context, component string) (v1.Descriptor, error) {
	manifests := make([]v1.Descriptor, 0, len(release.platforms))
	for _, platform := range release.platforms {
		descriptor, err := release.publishDisk(ctx, component, platform)
		if err != nil {
			return v1.Descriptor{}, fmt.Errorf("publish %s %s disk artifact: %w", component, platform.suffix, err)
		}
		manifests = append(manifests, descriptor)
	}
	componentManifest := v1.IndexManifest{
		SchemaVersion: ociIndexSchemaVersion,
		MediaType:     registrytypes.OCIImageIndex,
		ArtifactType:  componentArtifactType,
		Manifests:     manifests,
		Annotations: releaseAnnotations(release.cfg, map[string]string{
			componentAnnotation: component,
		}),
	}
	tag, err := release.tag(component + "-" + release.cfg.Version)
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("parse %s output tag: %w", component, err)
	}
	descriptor, err := putIndex(tag, componentManifest, release.options)
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("publish %s index: %w", component, err)
	}
	descriptor.Annotations = map[string]string{artifactNameAnnotation: component}
	return descriptor, nil
}

func (release publisher) tag(value string) (name.Tag, error) {
	return name.NewTag(release.repository.Name()+":"+value, release.nameOptions...)
}

func selectedPublishPlatforms(value string) ([]publishPlatform, error) {
	requested := strings.Split(value, ",")
	selected := make([]publishPlatform, 0, len(requested))
	seen := make(map[string]struct{}, len(requested))
	for _, candidate := range requested {
		platformName := strings.TrimSpace(candidate)
		if platformName == "" {
			continue
		}
		if _, exists := seen[platformName]; exists {
			return nil, fmt.Errorf("publish platform %s is repeated", platformName)
		}
		matched := false
		for _, platform := range publishedPlatforms() {
			if platform.platform.String() != platformName {
				continue
			}
			selected = append(selected, platform)
			seen[platformName] = struct{}{}
			matched = true
			break
		}
		if !matched {
			return nil, fmt.Errorf("unsupported publish platform %s", platformName)
		}
	}
	if len(selected) == 0 {
		return nil, errors.New("at least one publish platform is required")
	}
	return selected, nil
}

func releaseAnnotations(cfg PublishConfig, extra map[string]string) map[string]string {
	annotations := map[string]string{
		ociVersionAnnotation:  cfg.Version,
		ociRevisionAnnotation: cfg.Revision,
		protocolAnnotation:    fmt.Sprint(guest.ControlProtocolVersion),
	}
	for key, value := range extra {
		annotations[key] = value
	}
	return annotations
}

func putIndex(tag name.Tag, manifest v1.IndexManifest, options []remote.Option) (v1.Descriptor, error) {
	encoded, err := json.Marshal(manifest)
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("encode OCI index: %w", err)
	}
	if err := remote.Put(tag, rawIndex{manifest: encoded}, options...); err != nil {
		return v1.Descriptor{}, err
	}
	digest, size, err := v1.SHA256(bytes.NewReader(encoded))
	if err != nil {
		return v1.Descriptor{}, fmt.Errorf("digest OCI index: %w", err)
	}
	return v1.Descriptor{
		MediaType:    registrytypes.OCIImageIndex,
		ArtifactType: manifest.ArtifactType,
		Size:         size,
		Digest:       digest,
		Annotations:  map[string]string{},
	}, nil
}
