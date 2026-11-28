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

package microvm

import (
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/layout"
)

func ReferencedHostAssets(dataDir string) ([]string, error) {
	instances, err := state.ListInstanceMetadata(layout.NewPaths(dataDir))
	if err != nil {
		return nil, err
	}
	var referenced []string
	for _, instance := range instances {
		for _, path := range []string{instance.HypervisorBin, instance.KernelPath, instance.InitrdPath} {
			if path != "" {
				referenced = append(referenced, path)
			}
		}
	}
	return referenced, nil
}
