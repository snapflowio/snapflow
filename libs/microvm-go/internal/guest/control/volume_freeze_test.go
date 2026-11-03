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

package control

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
)

type volumeQuiescers struct {
	byPath   map[string]*recordingFilesystemQuiescer
	failPath string
}

type failingFilesystemQuiescer struct{}

func (failingFilesystemQuiescer) Freeze() error { return errors.New("freeze refused") }
func (failingFilesystemQuiescer) Thaw() error   { return nil }

func (quiescers *volumeQuiescers) factory(path string) filesystemQuiescer {
	if path == quiescers.failPath {
		return failingFilesystemQuiescer{}
	}
	quiescer := &recordingFilesystemQuiescer{}
	quiescers.byPath[path] = quiescer
	return quiescer
}

func newVolumeFreezeServer(t *testing.T, quiescers *volumeQuiescers) *Server {
	t.Helper()
	server, err := NewServer(testSessionResetter{}, controlTestStore(t), withVolumeQuiescer(quiescers.factory))
	if err != nil {
		t.Fatal(err)
	}
	return server
}

func postVolumeFreeze(t *testing.T, server *Server, body string) (*httptest.ResponseRecorder, error) {
	t.Helper()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, VolumesFreezePath, strings.NewReader(body))
	response := httptest.NewRecorder()
	return response, server.freezeVolumes(echo.New().NewContext(request, response))
}

func postVolumeThaw(t *testing.T, server *Server) {
	t.Helper()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, VolumesThawPath, nil)
	if err := server.thawVolumes(echo.New().NewContext(request, httptest.NewRecorder())); err != nil {
		t.Fatal(err)
	}
}

func TestVolumeFreezeFreezesEveryPathAndThawsOnce(t *testing.T) {
	quiescers := &volumeQuiescers{byPath: make(map[string]*recordingFilesystemQuiescer)}
	server := newVolumeFreezeServer(t, quiescers)
	if _, err := postVolumeFreeze(t, server, `{"mountPaths":["/data","/cache"]}`); err != nil {
		t.Fatal(err)
	}
	if server.volumes.autoThaw == nil {
		t.Fatal("volume freeze armed no safety thaw")
	}
	for range 2 {
		postVolumeThaw(t, server)
	}
	for path, quiescer := range quiescers.byPath {
		if quiescer.freezeCalls != 1 || quiescer.thawCalls != 1 {
			t.Fatalf("%s calls = freeze %d, thaw %d", path, quiescer.freezeCalls, quiescer.thawCalls)
		}
	}
	if len(quiescers.byPath) != 2 || server.volumes.autoThaw != nil {
		t.Fatalf("volume freeze state after thaw: %d volumes, timer %v", len(quiescers.byPath), server.volumes.autoThaw)
	}
}

func TestVolumeFreezeFailureThawsAlreadyFrozenVolumes(t *testing.T) {
	quiescers := &volumeQuiescers{byPath: make(map[string]*recordingFilesystemQuiescer), failPath: "/cache"}
	server := newVolumeFreezeServer(t, quiescers)
	if _, err := postVolumeFreeze(t, server, `{"mountPaths":["/data","/cache"]}`); err == nil {
		t.Fatal("expected the failed freeze to be reported")
	}
	if data := quiescers.byPath["/data"]; data.thawCalls != 1 {
		t.Fatalf("frozen volume thaw calls = %d, want 1", data.thawCalls)
	}
	if len(server.volumes.frozen) != 0 || server.volumes.autoThaw != nil {
		t.Fatal("failed freeze left volumes frozen")
	}
}

func TestVolumeFreezeSafetyTimerThawsOnlyItsOwnFreeze(t *testing.T) {
	quiescers := &volumeQuiescers{byPath: make(map[string]*recordingFilesystemQuiescer)}
	server := newVolumeFreezeServer(t, quiescers)
	if _, err := postVolumeFreeze(t, server, `{"mountPaths":["/data"]}`); err != nil {
		t.Fatal(err)
	}
	staleGeneration := server.volumes.generation
	if _, err := postVolumeFreeze(t, server, `{"mountPaths":["/data"]}`); err != nil {
		t.Fatal(err)
	}
	current := quiescers.byPath["/data"]
	server.autoThawVolumes(staleGeneration)
	if current.thawCalls != 0 {
		t.Fatal("a stale safety timer thawed a newer freeze")
	}
	server.autoThawVolumes(server.volumes.generation)
	if current.thawCalls != 1 || len(server.volumes.frozen) != 0 {
		t.Fatalf("safety timer thaw calls = %d", current.thawCalls)
	}
}

func TestVolumeFreezeRejectsInvalidPaths(t *testing.T) {
	quiescers := &volumeQuiescers{byPath: make(map[string]*recordingFilesystemQuiescer)}
	server := newVolumeFreezeServer(t, quiescers)
	for _, body := range []string{
		`{"mountPaths":[]}`,
		`{"mountPaths":["relative"]}`,
		`{"mountPaths":["/"]}`,
		`{"mountPaths":["/data/../etc"]}`,
		`{"mountPaths":["/data","/data"]}`,
		`{"mountPaths":["/data"],"extra":true}`,
	} {
		response, err := postVolumeFreeze(t, server, body)
		if err != nil || response.Code != http.StatusBadRequest {
			t.Fatalf("freeze %s = %d, %v; want a bad request", body, response.Code, err)
		}
	}
	if len(quiescers.byPath) != 0 {
		t.Fatal("an invalid freeze request froze a filesystem")
	}
}
