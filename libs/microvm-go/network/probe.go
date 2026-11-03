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

package network

// Boundaries the isolation probe exercises from a stand-in guest.
const (
	BoundaryInternet     = "internet"
	BoundaryHostLAN      = "host-lan"
	BoundaryHostTransit  = "host-transit"
	BoundaryGateway      = "gateway"
	BoundaryOtherSandbox = "other-sandbox"
	BoundaryLinkedPeer   = "linked-peer"
	BoundarySpoofedIP    = "spoofed-ip"
	BoundarySpoofedMAC   = "spoofed-mac"
)

// ProbeOutcome is one boundary the isolation probe tested: whether the guest
// must reach Target, and the violation when the boundary did not hold.
type ProbeOutcome struct {
	Boundary  string
	Target    string
	Reachable bool
	Err       error
}

// Held reports whether the guest saw exactly the reachability it must.
func (outcome ProbeOutcome) Held() bool { return outcome.Err == nil }
