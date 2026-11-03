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
	"testing"

	"github.com/snapflowio/microvm-go/layout"
)

func TestExampleInstanceSocketsFitLinuxPathBudget(t *testing.T) {
	paths := layout.NewPaths("/var/lib/snapflow-dev/ch")
	id := "9400dbb1-ed8e-48cd-b651-9650f9af795e"
	for name, path := range map[string]string{
		"cloud-hypervisor API": paths.InstanceSocket(id, APISocketName(HypervisorCloudHypervisor)),
		"guest vsock":          paths.InstanceVsock(id),
	} {
		if got, max := len(path), 107; got > max {
			t.Fatalf("%s path is %d bytes, exceeds Linux's %d-byte pathname budget: %s", name, got, max, path)
		}
	}
}
