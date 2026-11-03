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

package volumeartifact

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/internal/transferpolicy"
)

// objectStore is a presigned-URL stand-in: PUT stores a body and GET serves
// it with Range support.
type objectStore struct {
	mu            sync.Mutex
	objects       map[string][]byte
	rangeRequests map[string]int
}

func newObjectStore(t *testing.T) (*objectStore, *httptest.Server, Remote) {
	t.Helper()
	store := &objectStore{objects: make(map[string][]byte), rangeRequests: make(map[string]int)}
	server := httptest.NewServer(store)
	t.Cleanup(server.Close)
	policy, err := transferpolicy.New([]string{server.URL})
	if err != nil {
		t.Fatal(err)
	}
	return store, server, NewRemote(policy)
}

func (s *objectStore) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	switch request.Method {
	case http.MethodPut:
		if request.ContentLength < 0 {
			http.Error(response, "length required", http.StatusLengthRequired)
			return
		}
		body, err := io.ReadAll(request.Body)
		if err != nil {
			http.Error(response, err.Error(), http.StatusBadRequest)
			return
		}
		s.objects[request.URL.Path] = body
	case http.MethodGet:
		object, exists := s.objects[request.URL.Path]
		if !exists {
			http.NotFound(response, request)
			return
		}
		if request.Header.Get("Range") != "" {
			s.rangeRequests[request.URL.Path]++
		}
		http.ServeContent(response, request, "", time.Time{}, bytes.NewReader(object))
	default:
		http.Error(response, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func publish(t *testing.T, remote Remote, serverURL string, fixture backupFixture, base *Object) (Object, Object, Published) {
	t.Helper()
	artifactID := uuid.NewString()
	dataKey := newDataKey(t)
	published, err := remote.PublishBackup(t.Context(), PublishRequest{
		VolumeID: fixture.volumeID, ArtifactID: artifactID, DataKey: dataKey,
		PackUploadURL:     serverURL + "/" + artifactID + "/pack",
		ManifestUploadURL: serverURL + "/" + artifactID + "/manifest",
		Base:              base,
		SourcePath:        fixture.path,
		PackPath:          filepath.Join(t.TempDir(), "pack"),
	})
	if err != nil {
		t.Fatal(err)
	}
	manifest := Object{ArtifactID: artifactID, URL: serverURL + "/" + artifactID + "/manifest", DataKey: dataKey}
	pack := Object{ArtifactID: artifactID, URL: serverURL + "/" + artifactID + "/pack", DataKey: dataKey}
	return manifest, pack, published
}

func TestRemoteRestoreReadsPacksWithCoalescedRanges(t *testing.T) {
	store, server, remote := newObjectStore(t)
	fixture := newSparseVolume(t)
	firstManifest, firstPack, first := publish(t, remote, server.URL, fixture, nil)
	if first.PackSizeBytes == 0 || first.ManifestSizeBytes == 0 {
		t.Fatalf("published sizes = %+v", first)
	}

	writeBlock(t, fixture.path, 1, randomBytes(t, BlockSize))
	secondManifest, secondPack, second := publish(t, remote, server.URL, fixture, &firstManifest)
	if second.ChangedBytes != BlockSize {
		t.Fatalf("incremental changed bytes = %d", second.ChangedBytes)
	}
	wantReferenced := []string{firstManifest.ArtifactID, secondManifest.ArtifactID}
	slices.Sort(wantReferenced)
	if !slices.Equal(second.ReferencedArtifactIDs, wantReferenced) {
		t.Fatalf("referenced artifacts = %v, want %v", second.ReferencedArtifactIDs, wantReferenced)
	}

	destination := filepath.Join(t.TempDir(), "restored.raw")
	if err := remote.RestoreBackup(t.Context(), RestoreObjects{
		VolumeID: fixture.volumeID, Manifest: secondManifest,
		Packs:                   []Object{firstPack, secondPack},
		ExpectedVolumeSizeBytes: testVolumeSizeBytes, DestinationPath: destination,
	}); err != nil {
		t.Fatal(err)
	}
	assertSameContent(t, fixture.path, destination)

	firstPackPath := "/" + firstManifest.ArtifactID + "/pack"
	secondPackPath := "/" + secondManifest.ArtifactID + "/pack"
	// Block 0 lives in the first pack, block 1 in the second and block 4 in the
	// first again, so each pack run is fetched once per contiguous span.
	if store.rangeRequests[firstPackPath] != 2 || store.rangeRequests[secondPackPath] != 1 {
		t.Fatalf("range requests = %v", store.rangeRequests)
	}
}

func TestRemoteRestoreRejectsManifestWithMissingPack(t *testing.T) {
	_, server, remote := newObjectStore(t)
	fixture := newSparseVolume(t)
	manifest, _, _ := publish(t, remote, server.URL, fixture, nil)

	err := remote.RestoreBackup(t.Context(), RestoreObjects{
		VolumeID: fixture.volumeID, Manifest: manifest,
		ExpectedVolumeSizeBytes: testVolumeSizeBytes,
		DestinationPath:         filepath.Join(t.TempDir(), "restored.raw"),
	})
	if err == nil {
		t.Fatal("restore succeeded without the referenced pack")
	}
}

func TestRemoteRestoreRejectsRangeIgnoringServer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.WriteHeader(http.StatusOK)
	}))
	defer server.Close()
	policy, err := transferpolicy.New([]string{server.URL})
	if err != nil {
		t.Fatal(err)
	}
	ranges, err := NewRemote(policy).Ranges(server.URL + "/pack")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ranges.ReadRange(t.Context(), 0, BlockSize); err == nil {
		t.Fatal("a whole-object response was accepted as a range")
	}
}
