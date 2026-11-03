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
	"net/url"
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

const (
	ociIndexSchemaVersion  = 2
	indexSchema            = "snapflow.guest-release-index.v1"
	releaseArtifactType    = "application/vnd.snapflow.guest.release.v1"
	componentArtifactType  = "application/vnd.snapflow.guest.component.v1"
	benchmarkArtifactType  = "application/vnd.snapflow.guest.benchmark.v1"
	schemaAnnotation       = "io.snapflow.platform.schema"
	artifactNameAnnotation = "io.snapflow.platform.artifact"
	protocolAnnotation     = "io.snapflow.platform.control-protocol"
	componentAnnotation    = "io.snapflow.platform.component"
	ociVersionAnnotation   = "org.opencontainers.image.version"
	ociRevisionAnnotation  = "org.opencontainers.image.revision"
)

type artifactKind struct {
	indexType    string
	platformType string
}

func releaseArtifactKind(artifactName string) (artifactKind, bool) {
	switch artifactName {
	case guestspec.CoreArtifactName, guestspec.DesktopArtifactName:
		return artifactKind{indexType: componentArtifactType, platformType: imagecache.DiskArtifactType}, true
	case BenchmarkArtifactName:
		return artifactKind{indexType: benchmarkArtifactType}, true
	default:
		return artifactKind{}, false
	}
}

type parsedIndex struct {
	version    string
	revision   string
	components map[string]v1.Descriptor
}

func Resolve(
	ctx context.Context,
	releaseReference string,
	registryURL string,
	platform string,
) (*Release, error) {
	repository, expectedDigest, err := immutableReference(releaseReference)
	if err != nil {
		return nil, fmt.Errorf("guest release reference: %w", err)
	}
	reference, err := anonymousRegistryReference(releaseReference, registryURL)
	if err != nil {
		return nil, fmt.Errorf("guest release reference: %w", err)
	}
	descriptor, err := remote.Get(
		reference,
		remote.WithContext(ctx),
		remote.WithAuth(authn.Anonymous),
	)
	if err != nil {
		return nil, fmt.Errorf("fetch guest release index: %w", err)
	}
	if descriptor.Digest.String() != expectedDigest {
		return nil, errors.New("guest release registry response did not match the requested digest")
	}
	if descriptor.MediaType != registrytypes.OCIImageIndex {
		return nil, fmt.Errorf("guest release has unsupported media type %q", descriptor.MediaType)
	}
	index, err := descriptor.ImageIndex()
	if err != nil {
		return nil, fmt.Errorf("load guest release index: %w", err)
	}
	manifest, err := index.IndexManifest()
	if err != nil {
		return nil, fmt.Errorf("decode guest release index: %w", err)
	}
	parsed, err := parseReleaseIndex(manifest)
	if err != nil {
		return nil, err
	}
	artifacts := make(map[string]string, len(parsed.components))
	for artifactName, componentDescriptor := range parsed.components {
		artifactReference, err := resolveGuestComponent(
			ctx,
			repository,
			registryURL,
			platform,
			artifactName,
			componentDescriptor,
			parsed,
		)
		if err != nil {
			return nil, err
		}
		artifacts[artifactName] = artifactReference
	}

	return newRelease(releaseConfig{
		Version:        parsed.version,
		Digest:         expectedDigest,
		Platform:       platform,
		CoreImage:      artifacts[guestspec.CoreArtifactName],
		DesktopImage:   artifacts[guestspec.DesktopArtifactName],
		BenchmarkImage: artifacts[BenchmarkArtifactName],
	})
}

func parseReleaseIndex(manifest *v1.IndexManifest) (parsedIndex, error) {
	if manifest == nil {
		return parsedIndex{}, errors.New("guest release index is empty")
	}
	version, revision, err := parseReleaseIndexHeader(manifest)
	if err != nil {
		return parsedIndex{}, err
	}
	components := make(map[string]v1.Descriptor, len(manifest.Manifests))
	for _, descriptor := range manifest.Manifests {
		artifactName, err := parseComponentDescriptor(descriptor)
		if err != nil {
			return parsedIndex{}, err
		}
		if _, exists := components[artifactName]; exists {
			return parsedIndex{}, fmt.Errorf("guest release repeats artifact %q", artifactName)
		}
		components[artifactName] = descriptor
	}
	for _, required := range []string{guestspec.CoreArtifactName, BenchmarkArtifactName} {
		if _, exists := components[required]; !exists {
			return parsedIndex{}, fmt.Errorf("guest release must contain the %s artifact", required)
		}
	}
	return parsedIndex{version: version, revision: revision, components: components}, nil
}

func parseReleaseIndexHeader(manifest *v1.IndexManifest) (string, string, error) {
	if manifest.SchemaVersion != ociIndexSchemaVersion || manifest.MediaType != registrytypes.OCIImageIndex {
		return "", "", errors.New("guest release is not an OCI image index")
	}
	if manifest.ArtifactType != releaseArtifactType {
		return "", "", fmt.Errorf("unsupported guest release artifact type %q", manifest.ArtifactType)
	}
	if manifest.Annotations[schemaAnnotation] != indexSchema {
		return "", "", fmt.Errorf("unsupported guest release schema %q", manifest.Annotations[schemaAnnotation])
	}
	version := strings.TrimSpace(manifest.Annotations[ociVersionAnnotation])
	if version == "" {
		return "", "", errors.New("guest release version annotation is required")
	}
	revision := strings.TrimSpace(manifest.Annotations[ociRevisionAnnotation])
	if revision == "" {
		return "", "", errors.New("guest release revision annotation is required")
	}
	if err := requireControlProtocol(manifest.Annotations, "guest release"); err != nil {
		return "", "", err
	}
	return version, revision, nil
}

func parseComponentDescriptor(descriptor v1.Descriptor) (string, error) {
	artifactName := strings.TrimSpace(descriptor.Annotations[artifactNameAnnotation])
	kind, known := releaseArtifactKind(artifactName)
	if !known {
		return "", fmt.Errorf("guest release contains unknown artifact %q", artifactName)
	}
	if descriptor.MediaType != registrytypes.OCIImageIndex {
		return "", fmt.Errorf("guest artifact %q is not a multi-platform OCI index", artifactName)
	}
	if descriptor.ArtifactType != kind.indexType {
		return "", fmt.Errorf("guest artifact %q has unsupported artifact type %q", artifactName, descriptor.ArtifactType)
	}
	if _, err := parseSHA256Digest(descriptor.Digest.String()); err != nil {
		return "", fmt.Errorf("guest artifact %q digest: %w", artifactName, err)
	}
	return artifactName, nil
}

func requireControlProtocol(annotations map[string]string, subject string) error {
	wantProtocol := fmt.Sprint(guest.ControlProtocolVersion)
	if annotations[protocolAnnotation] != wantProtocol {
		return fmt.Errorf("%s control protocol is %q, expected %q", subject, annotations[protocolAnnotation], wantProtocol)
	}
	return nil
}

func resolveGuestComponent(
	ctx context.Context,
	repository string,
	registryURL string,
	platform string,
	artifactName string,
	descriptor v1.Descriptor,
	release parsedIndex,
) (string, error) {
	componentDigest, err := parseSHA256Digest(descriptor.Digest.String())
	if err != nil {
		return "", fmt.Errorf("guest artifact %q digest: %w", artifactName, err)
	}
	componentReference := repository + "@" + componentDigest.String()
	reference, err := anonymousRegistryReference(componentReference, registryURL)
	if err != nil {
		return "", fmt.Errorf("guest artifact %q reference: %w", artifactName, err)
	}
	remoteDescriptor, err := remote.Get(
		reference,
		remote.WithContext(ctx),
		remote.WithAuth(authn.Anonymous),
	)
	if err != nil {
		return "", fmt.Errorf("fetch guest artifact %q index: %w", artifactName, err)
	}
	if remoteDescriptor.Digest != descriptor.Digest {
		return "", fmt.Errorf("guest artifact %q registry response did not match the requested digest", artifactName)
	}
	if remoteDescriptor.MediaType != registrytypes.OCIImageIndex {
		return "", fmt.Errorf("guest artifact %q has unsupported media type %q", artifactName, remoteDescriptor.MediaType)
	}
	index, err := remoteDescriptor.ImageIndex()
	if err != nil {
		return "", fmt.Errorf("load guest artifact %q index: %w", artifactName, err)
	}
	manifest, err := index.IndexManifest()
	if err != nil {
		return "", fmt.Errorf("decode guest artifact %q index: %w", artifactName, err)
	}
	imageDigest, err := selectGuestComponentPlatform(artifactName, platform, release, manifest)
	if err != nil {
		return "", err
	}
	return repository + "@" + imageDigest, nil
}

func selectGuestComponentPlatform(
	artifactName string,
	platform string,
	release parsedIndex,
	manifest *v1.IndexManifest,
) (string, error) {
	kind, known := releaseArtifactKind(artifactName)
	if !known {
		return "", fmt.Errorf("guest release contains unknown artifact %q", artifactName)
	}
	if err := validateComponentIndex(artifactName, kind, release, manifest); err != nil {
		return "", err
	}
	selected, err := platformDescriptor(artifactName, platform, manifest)
	if err != nil {
		return "", err
	}
	if selected.MediaType != registrytypes.OCIManifestSchema1 || selected.ArtifactType != kind.platformType {
		return "", fmt.Errorf(
			"guest artifact %q platform %q is %q (%q), expected an OCI manifest of artifact type %q",
			artifactName, platform, selected.MediaType, selected.ArtifactType, kind.platformType,
		)
	}
	imageDigest, err := parseSHA256Digest(selected.Digest.String())
	if err != nil {
		return "", fmt.Errorf("guest artifact %q platform %q digest: %w", artifactName, platform, err)
	}
	return imageDigest.String(), nil
}

func validateComponentIndex(artifactName string, kind artifactKind, release parsedIndex, manifest *v1.IndexManifest) error {
	if manifest == nil || manifest.SchemaVersion != ociIndexSchemaVersion || manifest.MediaType != registrytypes.OCIImageIndex {
		return fmt.Errorf("guest artifact %q is not an OCI image index", artifactName)
	}
	if manifest.ArtifactType != kind.indexType {
		return fmt.Errorf("guest artifact %q has unsupported artifact type %q", artifactName, manifest.ArtifactType)
	}
	if manifest.Annotations[componentAnnotation] != artifactName {
		return fmt.Errorf("guest artifact %q component annotation is %q", artifactName, manifest.Annotations[componentAnnotation])
	}
	if manifest.Annotations[ociVersionAnnotation] != release.version {
		return fmt.Errorf("guest artifact %q version does not match its release", artifactName)
	}
	if manifest.Annotations[ociRevisionAnnotation] != release.revision {
		return fmt.Errorf("guest artifact %q revision does not match its release", artifactName)
	}
	return requireControlProtocol(manifest.Annotations, fmt.Sprintf("guest artifact %q", artifactName))
}

func platformDescriptor(artifactName, platform string, manifest *v1.IndexManifest) (*v1.Descriptor, error) {
	wantPlatform, err := v1.ParsePlatform(platform)
	if err != nil || wantPlatform.OS == "" || wantPlatform.Architecture == "" {
		return nil, fmt.Errorf("parse guest platform %q: OS and architecture are required", platform)
	}
	var selected *v1.Descriptor
	for index := range manifest.Manifests {
		candidate := &manifest.Manifests[index]
		if candidate.Platform == nil || !candidate.Platform.Equals(*wantPlatform) {
			continue
		}
		if selected != nil {
			return nil, fmt.Errorf("guest artifact %q repeats platform %q", artifactName, platform)
		}
		selected = candidate
	}
	if selected == nil {
		return nil, fmt.Errorf("guest artifact %q does not support platform %q", artifactName, platform)
	}
	return selected, nil
}

func anonymousRegistryReference(value, registryURL string) (name.Reference, error) {
	endpoint, err := url.Parse(strings.TrimSpace(registryURL))
	if err != nil {
		return nil, fmt.Errorf("parse guest registry URL: %w", err)
	}
	if endpoint.Host == "" || endpoint.User != nil || endpoint.Path != "" || endpoint.RawQuery != "" || endpoint.Fragment != "" {
		return nil, errors.New("guest registry URL must be an absolute origin")
	}
	options := []name.Option{name.StrictValidation}
	switch endpoint.Scheme {
	case "http":
		options = append(options, name.Insecure)
	case "https":
	default:
		return nil, errors.New("guest registry URL must use http or https")
	}
	reference, err := name.ParseReference(strings.TrimSpace(value), options...)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(reference.Context().RegistryStr(), endpoint.Host) {
		return nil, fmt.Errorf(
			"guest registry host %s does not match release registry %s",
			endpoint.Host,
			reference.Context().RegistryStr(),
		)
	}
	return reference, nil
}

func immutableReference(value string) (string, string, error) {
	named, err := name.ParseReference(strings.TrimSpace(value), name.StrictValidation)
	if err != nil {
		return "", "", err
	}
	digest, ok := named.(name.Digest)
	if !ok {
		return "", "", errors.New("reference must be digest-pinned")
	}
	parsed, err := parseSHA256Digest(digest.DigestStr())
	if err != nil {
		return "", "", err
	}
	return digest.Context().Name(), parsed.String(), nil
}
