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

package firecracker

import (
	"context"
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"

	"github.com/snapflowio/microvm-go/hypervisor"
)

func TestPrepareForkRewritesStateAndCRC(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "source-a")
	target := filepath.Join(root, "target-b")
	snapshot := filepath.Join(root, "snapshot")
	if err := os.MkdirAll(snapshot, 0o755); err != nil {
		t.Fatal(err)
	}
	body := []byte("prefix:" + filepath.Join(source, "overlay.raw") + ":suffix")
	state := append(append([]byte(nil), body...), make([]byte, 8)...)
	binary.LittleEndian.PutUint64(state[len(body):], snapshotCRC64(body))
	if err := os.WriteFile(filepath.Join(snapshot, "state"), state, 0o644); err != nil {
		t.Fatal(err)
	}
	result, err := NewBackend().PrepareFork(context.Background(), hypervisor.ForkPrepareRequest{
		SnapshotPath: snapshot, SourceDataDir: source, TargetDataDir: target,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !result.Prepared {
		t.Fatal("expected snapshot to be prepared")
	}
	updated, err := os.ReadFile(filepath.Join(snapshot, "state"))
	if err != nil {
		t.Fatal(err)
	}
	if snapshotCRC64(updated) != 0 {
		t.Fatal("rewritten snapshot CRC is invalid")
	}
	if string(updated[:len(updated)-8]) != "prefix:"+filepath.Join(target, "overlay.raw")+":suffix" {
		t.Fatalf("unexpected rewritten state: %q", updated[:len(updated)-8])
	}
}

func TestPrepareForkRejectsDifferentPathLengths(t *testing.T) {
	snapshot := t.TempDir()
	body := []byte("/source/overlay.raw")
	state := append(append([]byte(nil), body...), make([]byte, 8)...)
	binary.LittleEndian.PutUint64(state[len(body):], snapshotCRC64(body))
	if err := os.WriteFile(filepath.Join(snapshot, "state"), state, 0o644); err != nil {
		t.Fatal(err)
	}
	result, err := NewBackend().PrepareFork(context.Background(), hypervisor.ForkPrepareRequest{
		SnapshotPath: snapshot, SourceDataDir: "/source", TargetDataDir: "/different-target",
	})
	if err == nil || result.Prepared {
		t.Fatalf("PrepareFork() = %#v, %v; want an unequal path length error", result, err)
	}
}
