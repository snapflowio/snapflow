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

package builds

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/snapflowio/microvm-go/internal/transferpolicy"
	"github.com/snapflowio/microvm-go/types"
)

type archiveEntry struct {
	name     string
	typeflag byte
	linkname string
	content  string
}

func TestPrepareContextDownloadsFromTrustedPlainHTTPOrigin(t *testing.T) {
	archivePath := writeContextArchive(
		t,
		archiveEntry{name: "Dockerfile", typeflag: tar.TypeReg, content: "FROM scratch\n"},
	)
	archive, err := os.ReadFile(archivePath)
	if err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(archive)
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if _, err := response.Write(archive); err != nil {
			t.Errorf("write build context archive: %v", err)
		}
	}))
	defer server.Close()
	request := types.BuildRequest{Contexts: []types.BuildContextArchive{{
		Hash:        "sha256:" + hex.EncodeToString(digest[:]),
		DownloadURL: server.URL + "/context.tar.gz",
	}}}

	untrusted := PrepareContext(t.Context(), filepath.Join(t.TempDir(), "context"), request, Config{}, transferpolicy.Policy{})
	if !errors.Is(untrusted, transferpolicy.ErrInsecureTransport) {
		t.Fatalf("untrusted plain-HTTP context error = %v, want ErrInsecureTransport", untrusted)
	}
	transfers, err := transferpolicy.New([]string{server.URL})
	if err != nil {
		t.Fatal(err)
	}
	root := filepath.Join(t.TempDir(), "context")
	if err := PrepareContext(t.Context(), root, request, Config{}, transfers); err != nil {
		t.Fatalf("trusted plain-HTTP context download: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "Dockerfile")); err != nil {
		t.Fatalf("extracted Dockerfile: %v", err)
	}
}

func writeContextArchive(t *testing.T, entries ...archiveEntry) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "context.tar.gz")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	gzipWriter := gzip.NewWriter(file)
	tarWriter := tar.NewWriter(gzipWriter)
	for _, entry := range entries {
		header := &tar.Header{
			Name:     entry.name,
			Typeflag: entry.typeflag,
			Linkname: entry.linkname,
			Mode:     0o644,
			Size:     int64(len(entry.content)),
		}
		if err := tarWriter.WriteHeader(header); err != nil {
			t.Fatal(err)
		}
		if entry.content != "" {
			if _, err := tarWriter.Write([]byte(entry.content)); err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := tarWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gzipWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestExtractTarGzRejectsSymlinksBeforeFollowingEntries(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	archive := writeContextArchive(
		t,
		archiveEntry{name: "escape", typeflag: tar.TypeSymlink, linkname: outside},
		archiveEntry{name: "escape/owned", typeflag: tar.TypeReg, content: "owned"},
	)

	err := extractTarArchive(archive, root, 1024, 10)
	if err == nil || !strings.Contains(err.Error(), "symlinks are not supported") {
		t.Fatalf("expected symlink rejection, got %v", err)
	}
	if _, err := os.Stat(filepath.Join(outside, "owned")); !os.IsNotExist(err) {
		t.Fatalf("archive wrote outside extraction root: %v", err)
	}
}

func TestExtractTarGzEnforcesExpandedSizeLimit(t *testing.T) {
	archive := writeContextArchive(
		t,
		archiveEntry{name: "large", typeflag: tar.TypeReg, content: "12345"},
	)

	err := extractTarArchive(archive, t.TempDir(), 4, 10)
	if err == nil || !strings.Contains(err.Error(), "expanded limit") {
		t.Fatalf("expected expanded size rejection, got %v", err)
	}
}

func TestExtractTarGzEnforcesEntryLimit(t *testing.T) {
	archive := writeContextArchive(
		t,
		archiveEntry{name: "first", typeflag: tar.TypeReg, content: "1"},
		archiveEntry{name: "second", typeflag: tar.TypeReg, content: "2"},
	)

	err := extractTarArchive(archive, t.TempDir(), 1024, 1)
	if err == nil || !strings.Contains(err.Error(), "more than 1 entries") {
		t.Fatalf("expected entry limit rejection, got %v", err)
	}
}

func TestSafeArchivePathRejectsTraversalAndPlatformSeparators(t *testing.T) {
	for _, name := range []string{"../secret", "/absolute", `..\secret`, "."} {
		if _, err := safeArchivePath(name); err == nil {
			t.Errorf("safeArchivePath(%q) unexpectedly succeeded", name)
		}
	}
}

func TestBuildContextDialPolicyRejectsNonPublicNetworks(t *testing.T) {
	for _, raw := range []string{
		"127.0.0.1",
		"10.0.0.1",
		"100.64.0.1",
		"169.254.169.254",
		"192.0.2.1",
		"::1",
		"fd00::1",
		"fe80::1",
		"2001:db8::1",
	} {
		if isPublicContextAddress(netip.MustParseAddr(raw)) {
			t.Errorf("address %s unexpectedly allowed", raw)
		}
	}
	for _, raw := range []string{"1.1.1.1", "2606:4700:4700::1111"} {
		if !isPublicContextAddress(netip.MustParseAddr(raw)) {
			t.Errorf("public address %s unexpectedly rejected", raw)
		}
	}
}

func TestBuildContextSHA256RejectsMalformedHashes(t *testing.T) {
	valid := strings.Repeat("a", 64)
	if got, err := buildContextSHA256("sha256:" + valid); err != nil || got != valid {
		t.Fatalf("valid SHA-256 = %q, %v", got, err)
	}
	for _, value := range []string{"", strings.Repeat("a", 32), strings.Repeat("z", 64)} {
		if _, err := buildContextSHA256(value); err == nil {
			t.Errorf("buildContextSHA256(%q) unexpectedly succeeded", value)
		}
	}
}
