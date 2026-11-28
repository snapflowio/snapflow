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
	"fmt"
	"os"
	"strings"

	"github.com/snapflowio/microvm-go/hypervisor"
)

const serialSocketSuffix = ".sock"

func (Backend) PrepareFork(ctx context.Context, request hypervisor.ForkPrepareRequest) (hypervisor.ForkPrepareResult, error) {
	if err := ctx.Err(); err != nil {
		return hypervisor.ForkPrepareResult{}, err
	}
	if request.SnapshotPath == "" {
		return hypervisor.ForkPrepareResult{Prepared: true}, nil
	}
	err := editSnapshotConfig(request.SnapshotPath, func(config map[string]any) (map[string]any, bool) {
		rewritten := rewriteForkConfig(config, request.SourceDataDir, request.TargetDataDir)
		applyForkTarget(rewritten, request.Target)
		return rewritten, true
	})
	if err != nil {
		return hypervisor.ForkPrepareResult{}, fmt.Errorf("prepare Cloud Hypervisor fork: %w", err)
	}
	return hypervisor.ForkPrepareResult{Prepared: true}, nil
}

func rewriteForkConfig(config map[string]any, sourceDir, targetDir string) map[string]any {
	rewritten := make(map[string]any, len(config))
	for key, child := range config {
		rewritten[key] = rewriteForkPaths(child, sourceDir, targetDir)
	}
	return rewritten
}

func applyForkTarget(config map[string]any, target hypervisor.VM) {
	if vsock, ok := config["vsock"].(map[string]any); ok && target.VsockSocket != "" {
		vsock["socket"] = target.VsockSocket
	}
	if networks, ok := config["net"].([]any); ok {
		applyForkNetworks(networks, target.Networks)
	}
	if serial, ok := config["serial"].(map[string]any); ok && target.SerialLogPath != "" {
		applyForkSerial(serial, target.SerialLogPath)
	}
}

func applyForkNetworks(networks []any, targets []hypervisor.Network) {
	for index := range min(len(networks), len(targets)) {
		network, ok := networks[index].(map[string]any)
		if !ok {
			continue
		}
		network["tap"] = targets[index].TAPDevice
		network["ip"] = targets[index].IP
		network["mac"] = targets[index].MAC
		network["mask"] = targets[index].Netmask
	}
}

func applyForkSerial(serial map[string]any, serialLogPath string) {
	if _, exists := serial["file"]; exists {
		serial["file"] = serialLogPath
	}
	if _, exists := serial["socket"]; exists {
		serial["socket"] = serialLogPath + serialSocketSuffix
	}
}

func rewriteForkPaths(value any, sourceDir, targetDir string) any {
	switch typed := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(typed))
		for key, child := range typed {
			out[key] = rewriteForkPaths(child, sourceDir, targetDir)
		}
		return out
	case []any:
		out := make([]any, len(typed))
		for i, child := range typed {
			out[i] = rewriteForkPaths(child, sourceDir, targetDir)
		}
		return out
	case string:
		if typed == sourceDir || strings.HasPrefix(typed, sourceDir+string(os.PathSeparator)) {
			return targetDir + strings.TrimPrefix(typed, sourceDir)
		}
	}
	return value
}
