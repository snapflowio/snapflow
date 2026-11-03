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
	"errors"
	"os"
	"testing"
)

const (
	referenceTestRepository     = "docker.io/library/alpine"
	referenceTestIndexDigest    = "sha256:48b0309ca019d89d40f670aa1bc06e426dc0931948452e8491e3d65087abc07d"
	referenceTestManifestDigest = "sha256:f27cad9117495d32d067133afff942cb2dc745dfe9163e949f6bfe8a6a245339"
)

func TestIndexDigestReferenceResolvesToPreparedManifest(t *testing.T) {
	store := newTestStore(t)
	record := ImageRecord{Repository: referenceTestRepository, Digest: referenceTestManifestDigest, Status: ImageStatusReady}
	if err := store.Write(record); err != nil {
		t.Fatal(err)
	}
	indexReference := referenceTestRepository + "@" + referenceTestIndexDigest
	if err := store.linkReference(indexReference, record); err != nil {
		t.Fatal(err)
	}

	resolved, err := store.ReadReference(indexReference)
	if err != nil {
		t.Fatalf("read index reference: %v", err)
	}
	if resolved.Digest != referenceTestManifestDigest {
		t.Fatalf("index reference resolved to %s, want %s", resolved.Digest, referenceTestManifestDigest)
	}
	manifestReference := referenceTestRepository + "@" + referenceTestManifestDigest
	if _, err := store.ReadReference(manifestReference); err != nil {
		t.Fatalf("read manifest reference: %v", err)
	}

	if err := store.Remove(indexReference); err != nil {
		t.Fatalf("remove index reference: %v", err)
	}
	if _, err := store.ReadReference(indexReference); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("index reference after removal: got %v, want not exist", err)
	}
	if _, err := store.ReadReference(manifestReference); err != nil {
		t.Fatalf("removing the alias must keep the manifest: %v", err)
	}
}

func TestManifestDigestReferenceWritesNoAlias(t *testing.T) {
	store := newTestStore(t)
	record := ImageRecord{Repository: referenceTestRepository, Digest: referenceTestManifestDigest, Status: ImageStatusReady}
	if err := store.Write(record); err != nil {
		t.Fatal(err)
	}
	if err := store.linkReference(referenceTestRepository+"@"+referenceTestManifestDigest, record); err != nil {
		t.Fatal(err)
	}
	alias := store.paths.ImageDigestAliasLink(referenceTestRepository, record.DigestHex())
	if _, err := os.Lstat(alias); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("unexpected alias link: %v", err)
	}
}
