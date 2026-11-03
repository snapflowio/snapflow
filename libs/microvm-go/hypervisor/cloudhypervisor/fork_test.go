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

package cloudhypervisor

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/snapflowio/microvm-go/hypervisor"
)

func TestPrepareForkRewritesPathsAndDeviceIdentity(t *testing.T) {
	sourceDir := filepath.Join(t.TempDir(), "source")
	targetDir := filepath.Join(filepath.Dir(sourceDir), "target")
	snapshotDir := filepath.Join(targetDir, "snapshots", "latest")
	if err := os.MkdirAll(snapshotDir, 0o755); err != nil {
		t.Fatal(err)
	}
	config := map[string]any{
		"disks": []any{map[string]any{"path": filepath.Join(sourceDir, "overlay.raw")}},
		"vsock": map[string]any{"socket": filepath.Join(sourceDir, "vsock.sock")},
		"net":   []any{map[string]any{"tap": "old", "ip": "10.0.0.2", "mac": "old", "mask": "255.255.255.0"}},
	}
	data, err := json.Marshal(config)
	if err != nil {
		t.Fatalf("marshal VM config: %v", err)
	}
	if err := os.WriteFile(filepath.Join(snapshotDir, "config.json"), data, 0o644); err != nil {
		t.Fatal(err)
	}
	target := hypervisor.VM{
		VsockSocket: filepath.Join(targetDir, "vsock.sock"),
		Networks: []hypervisor.Network{{
			TAPDevice: "new-tap",
			IP:        "10.0.0.3",
			MAC:       "02:00:00:00:00:03",
			Netmask:   "255.255.255.0",
		}},
	}
	result, err := NewBackend().PrepareFork(context.Background(), hypervisor.ForkPrepareRequest{
		SnapshotPath: snapshotDir, SourceDataDir: sourceDir, TargetDataDir: targetDir, Target: target,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !result.Prepared {
		t.Fatal("expected snapshot to be prepared")
	}
	updated, err := os.ReadFile(filepath.Join(snapshotDir, "config.json"))
	if err != nil {
		t.Fatal(err)
	}
	if string(updated) == string(data) {
		t.Fatal("snapshot configuration was not rewritten")
	}
	var decoded struct {
		Vsock struct {
			Socket string `json:"socket"`
		} `json:"vsock"`
		Net []struct {
			Tap string `json:"tap"`
			IP  string `json:"ip"`
		} `json:"net"`
	}
	if err := json.Unmarshal(updated, &decoded); err != nil {
		t.Fatal(err)
	}
	if got := decoded.Vsock.Socket; got != target.VsockSocket {
		t.Fatalf("vsock socket = %v", got)
	}
	if len(decoded.Net) == 0 {
		t.Fatal("snapshot configuration has no network")
	}
	network := decoded.Net[0]
	if network.Tap != "new-tap" || network.IP != "10.0.0.3" {
		t.Fatalf("network was not rewritten: %#v", network)
	}
}
