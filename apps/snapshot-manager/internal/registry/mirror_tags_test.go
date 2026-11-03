// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
package registry

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

const (
	alpineTagPath    = "/v2/library/alpine/manifests/3.20"
	alpineDigest     = "sha256:48b0309ca019d89d40f670aa1bc06e426dc0931948452e8491e3d65087abc07d"
	alpineDigestPath = "/v2/library/alpine/manifests/" + alpineDigest
	ociIndexAccept   = "application/vnd.oci.image.index.v1+json"
	manifestAccept   = "application/vnd.oci.image.manifest.v1+json"
)

type recordingMirror struct {
	paths  []string
	status int
}

func (mirror *recordingMirror) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	mirror.paths = append(mirror.paths, r.URL.Path)
	w.Header().Set(headerContentDigest, alpineDigest)
	w.WriteHeader(mirror.status)
}

func serveMirror(t *testing.T, handler http.Handler, method, path, accept string) {
	t.Helper()
	request := httptest.NewRequestWithContext(t.Context(), method, path, http.NoBody)
	request.Header.Set(headerAccept, accept)
	handler.ServeHTTP(httptest.NewRecorder(), request)
}

func TestMirrorTagCacheServesRepeatedTagLookupsByDigest(t *testing.T) {
	mirror := &recordingMirror{status: http.StatusOK}
	handler := newMirrorTags().handler(mirror)
	serveMirror(t, handler, http.MethodHead, alpineTagPath, ociIndexAccept)
	serveMirror(t, handler, http.MethodGet, alpineTagPath, ociIndexAccept)
	serveMirror(t, handler, http.MethodGet, alpineTagPath, manifestAccept)
	want := []string{alpineTagPath, alpineDigestPath, alpineTagPath}
	if len(mirror.paths) != len(want) {
		t.Fatalf("mirror paths = %v, want %v", mirror.paths, want)
	}
	for index := range want {
		if mirror.paths[index] != want[index] {
			t.Fatalf("mirror paths = %v, want %v", mirror.paths, want)
		}
	}
}

func TestMirrorTagCacheIgnoresFailedAndDigestRequests(t *testing.T) {
	mirror := &recordingMirror{status: http.StatusUnauthorized}
	handler := newMirrorTags().handler(mirror)
	serveMirror(t, handler, http.MethodGet, alpineTagPath, ociIndexAccept)
	serveMirror(t, handler, http.MethodGet, alpineTagPath, ociIndexAccept)
	serveMirror(t, handler, http.MethodGet, alpineDigestPath, ociIndexAccept)
	serveMirror(t, handler, http.MethodPut, alpineTagPath, ociIndexAccept)
	want := []string{alpineTagPath, alpineTagPath, alpineDigestPath, alpineTagPath}
	for index := range want {
		if index >= len(mirror.paths) || mirror.paths[index] != want[index] {
			t.Fatalf("mirror paths = %v, want %v", mirror.paths, want)
		}
	}
}
