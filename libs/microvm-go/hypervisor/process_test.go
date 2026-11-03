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

package hypervisor

import (
	"context"
	"errors"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSocketReadinessUsesAConnectableUnixSocket(t *testing.T) {
	path := filepath.Join(t.TempDir(), "vmm.sock")
	if IsSocketInUse(t.Context(), path) {
		t.Fatal("missing socket reported as in use")
	}
	listener, err := new(net.ListenConfig).Listen(t.Context(), "unix", path)
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	go func() {
		connection, err := listener.Accept()
		if err == nil {
			if err := connection.Close(); err != nil {
				t.Errorf("close accepted connection: %v", err)
			}
		}
	}()
	if err := WaitForSocket(context.Background(), path); err != nil {
		t.Fatal(err)
	}
}

func TestSocketReadinessHonorsCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	err := WaitForSocket(ctx, filepath.Join(t.TempDir(), "missing.sock"))
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("WaitForSocket error = %v, want context cancellation", err)
	}
}

func TestWithLogTailReadsOnlyBoundedSuffix(t *testing.T) {
	path := filepath.Join(t.TempDir(), "vmm.log")
	prefix := strings.Repeat("discarded", 1024)
	tail := strings.Repeat("tail", 1024)
	if err := os.WriteFile(path, []byte(prefix+tail), 0o600); err != nil {
		t.Fatal(err)
	}

	message := WithLogTail(errors.New("launch failed"), path).Error()
	if strings.Contains(message, "discarded") {
		t.Fatal("error included data before the bounded log tail")
	}
	if !strings.HasSuffix(message, tail) {
		t.Fatal("error did not include the complete 4 KiB log tail")
	}
}
