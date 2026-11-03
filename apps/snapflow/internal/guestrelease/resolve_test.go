// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package guestrelease

import (
	"fmt"
	"testing"

	v1 "github.com/google/go-containerregistry/pkg/v1"
	registrytypes "github.com/google/go-containerregistry/pkg/v1/types"
	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/imagecache"
)

const (
	testComponentDigest = "sha256:4444444444444444444444444444444444444444444444444444444444444444"
	testPlatform        = "linux/amd64"
)

func componentIndex(t *testing.T, artifactType string) (parsedIndex, *v1.IndexManifest) {
	t.Helper()
	digest, err := v1.NewHash(testComponentDigest)
	if err != nil {
		t.Fatal(err)
	}
	release := parsedIndex{version: "1.0.0", revision: "revision"}
	return release, &v1.IndexManifest{
		SchemaVersion: ociIndexSchemaVersion,
		MediaType:     registrytypes.OCIImageIndex,
		ArtifactType:  componentArtifactType,
		Annotations: map[string]string{
			componentAnnotation:   guestspec.CoreArtifactName,
			ociVersionAnnotation:  release.version,
			ociRevisionAnnotation: release.revision,
			protocolAnnotation:    fmt.Sprint(guest.ControlProtocolVersion),
		},
		Manifests: []v1.Descriptor{{
			MediaType: registrytypes.OCIManifestSchema1, ArtifactType: artifactType, Digest: digest,
			Platform: &v1.Platform{OS: "linux", Architecture: "amd64"},
		}},
	}
}

func TestComponentPlatformSelectsTheDiskArtifact(t *testing.T) {
	release, manifest := componentIndex(t, imagecache.DiskArtifactType)
	digest, err := selectGuestComponentPlatform(guestspec.CoreArtifactName, testPlatform, release, manifest)
	if err != nil {
		t.Fatal(err)
	}
	if digest != testComponentDigest {
		t.Fatalf("selected digest %s, want %s", digest, testComponentDigest)
	}
}

func TestComponentPlatformRejectsAnUnconvertedImage(t *testing.T) {
	release, manifest := componentIndex(t, "")
	if _, err := selectGuestComponentPlatform(guestspec.CoreArtifactName, testPlatform, release, manifest); err == nil {
		t.Fatal("a component platform that is not a disk artifact was accepted")
	}
}

func TestBenchmarkPlatformSelectsTheRunnableImage(t *testing.T) {
	release, manifest := componentIndex(t, "")
	manifest.ArtifactType = benchmarkArtifactType
	manifest.Annotations[componentAnnotation] = BenchmarkArtifactName
	digest, err := selectGuestComponentPlatform(BenchmarkArtifactName, testPlatform, release, manifest)
	if err != nil {
		t.Fatal(err)
	}
	if digest != testComponentDigest {
		t.Fatalf("selected digest %s, want %s", digest, testComponentDigest)
	}
	manifest.Manifests[0].ArtifactType = imagecache.DiskArtifactType
	if _, err := selectGuestComponentPlatform(BenchmarkArtifactName, testPlatform, release, manifest); err == nil {
		t.Fatal("a benchmark platform that is a disk artifact was accepted")
	}
}

func TestReleaseIndexRequiresTheBenchmarkArtifact(t *testing.T) {
	annotations := map[string]string{
		schemaAnnotation:      indexSchema,
		ociVersionAnnotation:  "1.0.0",
		ociRevisionAnnotation: "revision",
		protocolAnnotation:    fmt.Sprint(guest.ControlProtocolVersion),
	}
	digest, err := v1.NewHash(testComponentDigest)
	if err != nil {
		t.Fatal(err)
	}
	core := v1.Descriptor{
		MediaType: registrytypes.OCIImageIndex, ArtifactType: componentArtifactType, Digest: digest,
		Annotations: map[string]string{artifactNameAnnotation: guestspec.CoreArtifactName},
	}
	manifest := &v1.IndexManifest{
		SchemaVersion: ociIndexSchemaVersion, MediaType: registrytypes.OCIImageIndex,
		ArtifactType: releaseArtifactType, Annotations: annotations, Manifests: []v1.Descriptor{core},
	}
	if _, err := parseReleaseIndex(manifest); err == nil {
		t.Fatal("a guest release without the benchmark artifact was accepted")
	}
	benchmark := v1.Descriptor{
		MediaType: registrytypes.OCIImageIndex, ArtifactType: benchmarkArtifactType, Digest: digest,
		Annotations: map[string]string{artifactNameAnnotation: BenchmarkArtifactName},
	}
	manifest.Manifests = append(manifest.Manifests, benchmark)
	if _, err := parseReleaseIndex(manifest); err != nil {
		t.Fatalf("a complete guest release was rejected: %v", err)
	}
}
