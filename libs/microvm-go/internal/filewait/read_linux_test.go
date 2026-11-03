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

package filewait

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

const (
	waitTestTimeout  = 5 * time.Second
	waitTestFileMode = 0o600
	waitTestDirMode  = 0o755
)

func TestReadWaitsForAFileCreatedInAMissingDirectory(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "ready")
	ctx, cancel := context.WithTimeout(context.Background(), waitTestTimeout)
	defer cancel()
	result := make(chan error, 1)
	go func() {
		data, err := Read(ctx, path, func(data []byte) error {
			if string(data) != "ready" {
				return errors.New("unexpected content")
			}
			return nil
		})
		if err == nil && string(data) != "ready" {
			err = errors.New("read returned unexpected content")
		}
		result <- err
	}()
	if err := os.MkdirAll(filepath.Dir(path), waitTestDirMode); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("ready"), waitTestFileMode); err != nil {
		t.Fatal(err)
	}
	if err := <-result; err != nil {
		t.Fatalf("read did not observe the created file: %v", err)
	}
}

func TestExistsStopsWhenTheContextIsCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	result := make(chan error, 1)
	go func() { result <- Exists(ctx, filepath.Join(t.TempDir(), "never")) }()
	cancel()
	select {
	case err := <-result:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("Exists error = %v, want cancellation", err)
		}
	case <-time.After(waitTestTimeout):
		t.Fatal("Exists did not observe cancellation")
	}
}
