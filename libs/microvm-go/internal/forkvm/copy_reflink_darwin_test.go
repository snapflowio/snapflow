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

//go:build darwin

package forkvm

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/sys/unix"
)

func TestDarwinCloneFallsBackAcrossVolumes(t *testing.T) {
	original := cloneFile
	cloneFile = func(string, string, int) error { return unix.EXDEV }
	t.Cleanup(func() { cloneFile = original })

	dir := t.TempDir()
	source := filepath.Join(dir, "source.raw")
	target := filepath.Join(dir, "target.raw")
	if err := os.WriteFile(source, []byte("instance-data"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := CopyFile(source, target); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(target)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "instance-data" {
		t.Fatalf("copied data = %q", data)
	}
}

func TestDarwinCloneCapabilityErrors(t *testing.T) {
	for _, err := range []error{unix.ENOTSUP, unix.EOPNOTSUPP, unix.EXDEV} {
		if !cloneUnsupported(err) {
			t.Fatalf("expected %v to be an unsupported capability error", err)
		}
	}
	for _, err := range []error{unix.EACCES, unix.EIO, unix.ENOSPC, unix.EINVAL} {
		if cloneUnsupported(err) || errors.Is(err, ErrReflinkUnsupported) {
			t.Fatalf("expected %v to remain a hard failure", err)
		}
	}
}
