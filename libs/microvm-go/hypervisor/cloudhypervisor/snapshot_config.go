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
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const (
	snapshotConfigFile     = "config.json"
	snapshotConfigFileMode = 0o644
	snapshotNetworksKey    = "net"
	snapshotHostMACKey     = "host_mac"
)

func editSnapshotConfig(snapshotPath string, edit func(map[string]any) (map[string]any, bool)) error {
	configPath := filepath.Join(snapshotPath, snapshotConfigFile)
	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("read Cloud Hypervisor snapshot configuration: %w", err)
	}
	var config map[string]any
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("decode Cloud Hypervisor snapshot configuration: %w", err)
	}
	edited, changed := edit(config)
	if !changed {
		return nil
	}
	updated, err := json.MarshalIndent(edited, "", "  ")
	if err != nil {
		return fmt.Errorf("encode Cloud Hypervisor snapshot configuration: %w", err)
	}
	if err := os.WriteFile(configPath, updated, snapshotConfigFileMode); err != nil {
		return fmt.Errorf("write Cloud Hypervisor snapshot configuration: %w", err)
	}
	return nil
}

func forgetHostMACs(config map[string]any) (map[string]any, bool) {
	networks, ok := config[snapshotNetworksKey].([]any)
	if !ok {
		return config, false
	}
	changed := false
	for _, entry := range networks {
		network, ok := entry.(map[string]any)
		if !ok {
			continue
		}
		if _, recorded := network[snapshotHostMACKey]; recorded {
			delete(network, snapshotHostMACKey)
			changed = true
		}
	}
	return config, changed
}
