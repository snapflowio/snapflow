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

//go:build linux

package control

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func testHostIdentityFiles(t *testing.T, withDBus bool) hostIdentityFiles {
	t.Helper()
	root := t.TempDir()
	files := hostIdentityFiles{
		hostname:      filepath.Join(root, "etc", "hostname"),
		machineID:     filepath.Join(root, "etc", "machine-id"),
		dbusMachineID: filepath.Join(root, "var", "lib", "dbus", "machine-id"),
	}
	if withDBus {
		if err := os.MkdirAll(filepath.Dir(files.dbusMachineID), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(files.dbusMachineID, []byte("seed\n"), 0o444); err != nil {
			t.Fatal(err)
		}
	}
	return files
}

func TestApplyHostIdentityFilesPersistsTheRotatedIdentity(t *testing.T) {
	files := testHostIdentityFiles(t, true)
	var kernelHostname string

	err := applyHostIdentityFiles(files, "abc123", "0123456789abcdef0123456789abcdef", func(hostname string) error {
		kernelHostname = hostname
		return nil
	})
	if err != nil {
		t.Fatalf("applyHostIdentityFiles() error = %v", err)
	}
	if kernelHostname != "abc123" {
		t.Fatalf("kernel hostname = %q, want abc123", kernelHostname)
	}
	for path, want := range map[string]string{
		files.hostname:      "abc123\n",
		files.machineID:     "0123456789abcdef0123456789abcdef\n",
		files.dbusMachineID: "0123456789abcdef0123456789abcdef\n",
	} {
		data, err := os.ReadFile(path)
		if err != nil || string(data) != want {
			t.Fatalf("%s = %q, %v; want %q", path, data, err, want)
		}
	}
}

func TestApplyHostIdentityFilesSkipsAbsentDBusMachineID(t *testing.T) {
	files := testHostIdentityFiles(t, false)
	if err := applyHostIdentityFiles(files, "abc123", "0123456789abcdef0123456789abcdef", func(string) error { return nil }); err != nil {
		t.Fatalf("applyHostIdentityFiles() error = %v", err)
	}
	if _, err := os.Stat(files.dbusMachineID); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("D-Bus machine id was created although the image has none: %v", err)
	}
}

func TestApplyHostIdentityFilesStopsWhenTheKernelHostnameFails(t *testing.T) {
	files := testHostIdentityFiles(t, false)
	hostnameErr := errors.New("sethostname rejected")
	err := applyHostIdentityFiles(files, "abc123", "0123456789abcdef0123456789abcdef", func(string) error { return hostnameErr })
	if !errors.Is(err, hostnameErr) {
		t.Fatalf("applyHostIdentityFiles() error = %v, want %v", err, hostnameErr)
	}
	if _, err := os.Stat(files.hostname); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("identity files were written after the kernel hostname failed")
	}
}
