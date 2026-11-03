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
	"net/http/httptest"
	"net/url"
	"os/exec"
	"testing"

	"github.com/google/go-containerregistry/pkg/name"
	"github.com/google/go-containerregistry/pkg/registry"
	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/mutate"
	"github.com/google/go-containerregistry/pkg/v1/random"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

const (
	testTemplateBundleRepository = "platform/core"
	testTemplateBundlePlatform   = "linux/amd64"
	testTemplateBundleLayerBytes = 512
	testTemplateBundleLayers     = 1
	testTemplateReleaseDigest    = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
)

func TestTemplateGuestArtifactsInstallDiskArtifactOnCacheMiss(t *testing.T) {
	formatter := testTemplateFormatter(t)
	reference, artifactDigest, registryConfig := publishTestDiskArtifact(t, formatter)
	store, err := imagecache.NewImageStore(imagecache.ImageStoreConfig{Paths: layout.NewPaths(t.TempDir()), Formatter: formatter})
	if err != nil {
		t.Fatal(err)
	}
	bundle := guest.Bundle{
		Name: "core", Version: "v1", ReleaseDigest: testTemplateReleaseDigest, Image: reference, Required: true,
		MountPath: guest.PlatformMountPath + "/core",
		Components: []guest.Manifest{{
			Name: "core", Version: "v1", GuestPath: guest.PlatformMountPath + "/core/guest",
			Activation: guest.ActivationRequired, ControlProtocolVersion: guest.ControlProtocolVersion,
			LifecycleSocket: "/run/snapflow/components/core.sock",
			Capabilities:    []guest.Capability{guest.CapabilityWorkloadInit},
		}},
	}
	backend := &Backend{
		images:              store,
		events:              lifecycle.NewEventBus(0),
		guestBundles:        []guest.Bundle{bundle},
		guestBundleRegistry: registryConfig,
	}

	resolved, err := backend.resolveTemplateGuestArtifacts(
		context.Background(),
		testTemplateBundlePlatform,
		types.CreateRequest{ID: "template-cache-miss"},
	)
	if err != nil {
		t.Fatalf("resolve template guest artifacts on a cold cache: %v", err)
	}
	if resolved.guestConfigDigest == "" {
		t.Fatal("the guest configuration digest is empty")
	}
	if len(resolved.platformBundleDigests) != 1 || resolved.platformBundleDigests[0] != artifactDigest.String() {
		t.Fatalf("platform bundle digests = %v, want [%s]", resolved.platformBundleDigests, artifactDigest)
	}
}

func testTemplateFormatter(t *testing.T) *imagecache.ErofsFormatter {
	t.Helper()
	path, err := exec.LookPath("mkfs.erofs")
	if err != nil {
		t.Fatalf("mkfs.erofs %s or newer is required: %v", imagecache.MinimumErofsUtilsVersion, err)
	}
	formatter, err := imagecache.NewErofsFormatter(imagecache.ErofsFormatterConfig{Path: path})
	if err != nil {
		t.Fatal(err)
	}
	return formatter
}

func publishTestDiskArtifact(t *testing.T, formatter *imagecache.ErofsFormatter) (string, gcr.Hash, *types.Registry) {
	t.Helper()
	source, err := random.Image(testTemplateBundleLayerBytes, testTemplateBundleLayers)
	if err != nil {
		t.Fatal(err)
	}
	config, err := source.ConfigFile()
	if err != nil {
		t.Fatal(err)
	}
	config.OS, config.Architecture = "linux", "amd64"
	source, err = mutate.ConfigFile(source, config)
	if err != nil {
		t.Fatal(err)
	}
	artifact, err := formatter.BuildDiskArtifact(context.Background(), imagecache.DiskArtifactRequest{Source: source, WorkDir: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	digest, err := artifact.Digest()
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(registry.New())
	t.Cleanup(server.Close)
	endpoint, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	tag, err := name.ParseReference(endpoint.Host+"/"+testTemplateBundleRepository+":disk", name.Insecure)
	if err != nil {
		t.Fatal(err)
	}
	if err := remote.Write(tag, artifact); err != nil {
		t.Fatal(err)
	}
	return endpoint.Host + "/" + testTemplateBundleRepository + "@" + digest.String(), digest, &types.Registry{URL: server.URL}
}
