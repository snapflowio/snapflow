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
	"fmt"

	"github.com/snapflowio/microvm-go/network"
)

// testAllocation is the network an instance would hold on transit slot.
func testAllocation(instanceID string, slot int) *network.Allocation {
	return &network.Allocation{
		Slot:           slot,
		Namespace:      network.NamespaceName(instanceID),
		HostVeth:       fmt.Sprintf("%s%x", network.VethPrefix, slot),
		TransitHost:    fmt.Sprintf("100.79.0.%d", slot*2),
		TransitSandbox: fmt.Sprintf("100.79.0.%d", slot*2+1),
		TAPDevice:      network.TAPName,
		IP:             network.GuestIP,
		MAC:            network.GuestMAC,
		Gateway:        network.GatewayIP,
		Netmask:        network.GuestNetmask,
		DNS:            "1.1.1.1",
	}
}
