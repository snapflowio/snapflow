// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package release

import (
	"archive/tar"
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/klauspost/compress/zstd"
)

const (
	testInputBytes   = 512
	testVersion      = "1.0.0"
	testRevision     = "0123456789abcdef"
	testGuestRelease = "registry.example.com/snapflow/guest@sha256:1111111111111111111111111111111111111111111111111111111111111111"
	testFileMode     = 0o644
)

func writeTestInput(t *testing.T, directory, name string) string {
	t.Helper()
	contents := make([]byte, testInputBytes)
	if _, err := rand.Read(contents); err != nil {
		t.Fatalf("generate %s: %v", name, err)
	}
	inputPath := filepath.Join(directory, name)
	if err := os.WriteFile(inputPath, contents, testFileMode); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
	return inputPath
}

func testBundle(t *testing.T) string {
	t.Helper()
	inputs := t.TempDir()
	output, err := BuildBundle(BundleConfig{
		Version: testVersion, Revision: testRevision, BuiltAt: time.Now(),
		Architecture: runtime.GOARCH, GuestRelease: testGuestRelease, OutputRoot: t.TempDir(),
		Inputs: BundleInputs{
			Snapflow: writeTestInput(t, inputs, "snapflow"), Snapflowd: writeTestInput(t, inputs, "snapflowd"),
			Firecracker:     writeTestInput(t, inputs, "firecracker"),
			CloudHypervisor: writeTestInput(t, inputs, "cloud-hypervisor"),
			MkfsErofs:       writeTestInput(t, inputs, "mkfs.erofs"), Kernel: writeTestInput(t, inputs, "kernel"),
			Initrd: writeTestInput(t, inputs, "initrd"), Notices: writeTestInput(t, inputs, "notices"),
		},
	})
	if err != nil {
		t.Fatalf("BuildBundle() error = %v", err)
	}
	if filepath.Base(output) != BundleFileName(testVersion, runtime.GOARCH) {
		t.Fatalf("BuildBundle() wrote %s", output)
	}
	return output
}

func TestBundleRoundTrip(t *testing.T) {
	bundle := testBundle(t)
	extracted := filepath.Join(t.TempDir(), "release")
	if err := ExtractBundleFile(bundle, extracted); err != nil {
		t.Fatalf("ExtractBundleFile() error = %v", err)
	}
	verified, err := LoadVerified(extracted, VerifyConfig{})
	if err != nil {
		t.Fatalf("LoadVerified() error = %v", err)
	}
	if verified.Manifest.Version != testVersion || len(verified.Manifest.Files) != len(requiredRoles())+1 {
		t.Fatalf("verified manifest = %+v", verified.Manifest)
	}
	if _, err := os.Stat(verified.Assets.Snapflowd); err != nil {
		t.Fatalf("snapflowd asset: %v", err)
	}
}

func TestLoadActiveFollowsTheCurrentRelease(t *testing.T) {
	installation := t.TempDir()
	contents, err := os.ReadFile(testBundle(t))
	if err != nil {
		t.Fatalf("read bundle: %v", err)
	}
	sum := sha256.Sum256(contents)
	name := hex.EncodeToString(sum[:])
	directory := filepath.Join(installation, ReleasesDirectoryName, name)
	if _, err := ExtractBundle(bytes.NewReader(contents), directory); err != nil {
		t.Fatalf("ExtractBundle() error = %v", err)
	}
	current := filepath.Join(installation, CurrentLinkName)
	if err := os.Symlink(filepath.Join(ReleasesDirectoryName, name), current); err != nil {
		t.Fatalf("link current release: %v", err)
	}
	active, err := LoadActive(installation, false)
	if err != nil {
		t.Fatalf("LoadActive() error = %v", err)
	}
	if active.BundleDigest != digestPrefix+name {
		t.Fatalf("active bundle digest = %s", active.BundleDigest)
	}
	if err := os.Remove(current); err != nil {
		t.Fatalf("remove current link: %v", err)
	}
	if err := os.Symlink(filepath.Join("..", name), current); err != nil {
		t.Fatalf("link escaping release: %v", err)
	}
	if _, err := LoadActive(installation, false); err == nil {
		t.Fatal("LoadActive() followed a pointer outside the release directory")
	}
}

type archiveEntry struct {
	name     string
	mode     int64
	uid      int
	typeflag byte
	data     []byte
}

func archiveOf(t *testing.T, entries ...archiveEntry) []byte {
	t.Helper()
	var raw bytes.Buffer
	archive := tar.NewWriter(&raw)
	for _, entry := range entries {
		typeflag := entry.typeflag
		if typeflag == 0 {
			typeflag = tar.TypeReg
		}
		header := &tar.Header{Name: entry.name, Mode: entry.mode, Size: int64(len(entry.data)), Uid: entry.uid, Typeflag: typeflag}
		if err := archive.WriteHeader(header); err != nil {
			t.Fatalf("write header: %v", err)
		}
		if _, err := archive.Write(entry.data); err != nil {
			t.Fatalf("write entry: %v", err)
		}
	}
	if err := archive.Close(); err != nil {
		t.Fatalf("close archive: %v", err)
	}
	return compress(t, raw.Bytes())
}

func compress(t *testing.T, raw []byte) []byte {
	t.Helper()
	var compressed bytes.Buffer
	encoder, err := zstd.NewWriter(&compressed)
	if err != nil {
		t.Fatalf("create encoder: %v", err)
	}
	if _, err := encoder.Write(raw); err != nil {
		t.Fatalf("compress archive: %v", err)
	}
	if err := encoder.Close(); err != nil {
		t.Fatalf("close encoder: %v", err)
	}
	return compressed.Bytes()
}

func TestExtractBundleRejectsUnsafeArchives(t *testing.T) {
	inside := func(name string) string { return path.Join(ReleaseRootDirectory, name) }
	payload := []byte("payload")
	tests := map[string][]byte{
		"path traversal":     archiveOf(t, archiveEntry{name: inside("../escape"), mode: manifestMode, data: payload}),
		"outside the root":   archiveOf(t, archiveEntry{name: "other/file", mode: manifestMode, data: payload}),
		"repeated path":      archiveOf(t, archiveEntry{name: inside("a"), mode: manifestMode, data: payload}, archiveEntry{name: inside("a"), mode: manifestMode, data: payload}),
		"not a regular file": archiveOf(t, archiveEntry{name: inside("link"), mode: manifestMode, typeflag: tar.TypeSymlink}),
		"not root owned":     archiveOf(t, archiveEntry{name: inside("a"), mode: manifestMode, uid: 1, data: payload}),
		"empty file":         archiveOf(t, archiveEntry{name: inside("a"), mode: manifestMode}),
		"unsafe mode":        archiveOf(t, archiveEntry{name: inside("a"), mode: 0o777, data: payload}),
		"writable manifest":  archiveOf(t, archiveEntry{name: inside(ManifestFileName), mode: executableFileMode, data: payload}),
		"missing manifest":   archiveOf(t, archiveEntry{name: inside("a"), mode: manifestMode, data: payload}),
		"trailing content":   withTrailingContent(t, testBundle(t)),
	}
	for name, archive := range tests {
		t.Run(name, func(t *testing.T) {
			if _, err := ExtractBundle(bytes.NewReader(archive), t.TempDir()); err == nil {
				t.Fatal("ExtractBundle() accepted an unsafe archive")
			}
		})
	}
}

func validManifest(t *testing.T) Manifest {
	t.Helper()
	extracted := filepath.Join(t.TempDir(), "release")
	if err := ExtractBundleFile(testBundle(t), extracted); err != nil {
		t.Fatalf("ExtractBundleFile() error = %v", err)
	}
	verified, err := LoadVerified(extracted, VerifyConfig{})
	if err != nil {
		t.Fatalf("LoadVerified() error = %v", err)
	}
	return verified.Manifest
}

func TestManifestValidateRejectsInvalidManifests(t *testing.T) {
	valid := validManifest(t)
	if err := valid.Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	tests := map[string]func(*Manifest){
		"schema":                 func(manifest *Manifest) { manifest.Schema = "other" },
		"product":                func(manifest *Manifest) { manifest.Product = "other" },
		"version":                func(manifest *Manifest) { manifest.Version = " " },
		"non-semantic version":   func(manifest *Manifest) { manifest.Version = "release-1" },
		"revision":               func(manifest *Manifest) { manifest.Revision = "" },
		"build time":             func(manifest *Manifest) { manifest.BuiltAt = time.Time{} },
		"operating system":       func(manifest *Manifest) { manifest.OS = "darwin" },
		"architecture":           func(manifest *Manifest) { manifest.Architecture = "riscv64" },
		"guest protocol":         func(manifest *Manifest) { manifest.Guest.ControlProtocolVersion = 0 },
		"mutable guest":          func(manifest *Manifest) { manifest.Guest.Reference = "registry.example.com/snapflow/guest:latest" },
		"missing roles":          func(manifest *Manifest) { manifest.Files = manifest.Files[:1] },
		"unsorted files":         func(manifest *Manifest) { manifest.Files[0], manifest.Files[1] = manifest.Files[1], manifest.Files[0] },
		"repeated role":          func(manifest *Manifest) { manifest.Files[1].Role = manifest.Files[0].Role },
		"invalid file mode":      func(manifest *Manifest) { manifest.Files[0].Mode = testFileMode },
		"missing required asset": func(manifest *Manifest) { manifest.Files[manifest.index(RoleKernel)].Role = RoleNotices },
	}
	for name, mutate := range tests {
		t.Run(name, func(t *testing.T) {
			manifest := valid
			manifest.Files = append([]File(nil), valid.Files...)
			mutate(&manifest)
			if err := manifest.Validate(); err == nil {
				t.Fatal("Validate() accepted an invalid manifest")
			}
		})
	}
}

func (manifest Manifest) index(role FileRole) int {
	for index, file := range manifest.Files {
		if file.Role == role {
			return index
		}
	}
	return -1
}

func withTrailingContent(t *testing.T, bundle string) []byte {
	t.Helper()
	compressed, err := os.ReadFile(bundle)
	if err != nil {
		t.Fatalf("read bundle: %v", err)
	}
	decoder, err := zstd.NewReader(bytes.NewReader(compressed))
	if err != nil {
		t.Fatalf("create decoder: %v", err)
	}
	defer decoder.Close()
	archive, err := decoder.DecodeAll(compressed, nil)
	if err != nil {
		t.Fatalf("decode bundle: %v", err)
	}
	return compress(t, append(archive, bytes.Repeat([]byte{1}, testInputBytes)...))
}
