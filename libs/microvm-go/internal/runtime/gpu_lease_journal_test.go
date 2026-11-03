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

package runtime

import (
	"testing"

	"github.com/snapflowio/microvm-go/devices"
)

func TestRestorableGPUAssignmentsProtectsReallocatedIOMMUGroups(t *testing.T) {
	t.Parallel()
	stale := []devices.GPUDevice{
		{
			PCIAddress: "0000:01:00.0",
			IOMMUGroup: 10,
			Bindings: []devices.PCIDeviceBinding{
				{PCIAddress: "0000:01:00.0"},
				{PCIAddress: "0000:01:00.1"},
			},
		},
		{PCIAddress: "0000:02:00.0", IOMMUGroup: 11},
	}
	active := map[string]struct{}{"0000:01:00.1": {}}

	restorable := restorableGPUAssignments(stale, active)
	if len(restorable) != 1 || restorable[0].PCIAddress != "0000:02:00.0" {
		t.Fatalf("restorable assignments = %#v", restorable)
	}
}
