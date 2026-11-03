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
	"errors"
	"os"
	"testing"
)

const (
	releasedReference = "docker.io/library/alpine:3.21"
	releasedTag       = "3.21"
	sharedTag         = "stable"
)

func TestReleaseRemovesAnUnreferencedImage(t *testing.T) {
	store, record := seedReadyImage(t, releasedReference)
	if err := store.Remove(releasedReference); err != nil {
		t.Fatal(err)
	}

	if err := store.Release(context.Background(), record, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(store.paths.ImageDigestDir(record.Repository, record.DigestHex())); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("released image directory still exists: %v", err)
	}
}

func TestReleaseKeepsAnImageAnotherTagReferences(t *testing.T) {
	store, record := seedReadyImage(t, releasedReference)
	if err := store.LinkTag(record.Repository, sharedTag, record.DigestHex()); err != nil {
		t.Fatal(err)
	}
	if err := store.Remove(releasedReference); err != nil {
		t.Fatal(err)
	}

	if err := store.Release(context.Background(), record, nil); err != nil {
		t.Fatal(err)
	}
	assertImageKept(t, store, record)
}

func TestReleaseKeepsAnImageARuntimeHolds(t *testing.T) {
	store, record := seedReadyImage(t, releasedReference)
	if err := store.Remove(releasedReference); err != nil {
		t.Fatal(err)
	}
	protected := map[string]bool{store.paths.ImageDigestDir(record.Repository, record.DigestHex()): true}

	if err := store.Release(context.Background(), record, protected); err != nil {
		t.Fatal(err)
	}
	assertImageKept(t, store, record)
}

func TestReleaseKeepsAStillTaggedImage(t *testing.T) {
	store, record := seedReadyImage(t, releasedReference)

	if err := store.Release(context.Background(), record, nil); err != nil {
		t.Fatal(err)
	}
	assertImageKept(t, store, record)
	if _, err := os.Lstat(store.paths.ImageTagLink(record.Repository, releasedTag)); err != nil {
		t.Fatalf("tag link was removed: %v", err)
	}
}

func assertImageKept(t *testing.T, store *ImageStore, record ImageRecord) {
	t.Helper()
	if _, err := os.Stat(store.paths.ImageDisk(record.Repository, record.DigestHex())); err != nil {
		t.Fatalf("image filesystem was removed: %v", err)
	}
}
