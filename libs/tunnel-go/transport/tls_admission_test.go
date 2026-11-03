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

package transport

import (
	"net/netip"
	"testing"
)

func TestTLSAdmissionListenerEnforcesGlobalAndSourceBounds(t *testing.T) {
	t.Parallel()
	listener := &tlsAdmissionListener{
		slots:    make(chan struct{}, 2),
		maxPerIP: 1,
		perIP:    make(map[netip.Addr]int),
	}
	firstIP := netip.MustParseAddr("192.0.2.1")
	secondIP := netip.MustParseAddr("192.0.2.2")
	first, accepted := listener.reserve(firstIP)
	if !accepted {
		t.Fatal("first source was rejected")
	}
	if duplicate, accepted := listener.reserve(firstIP); accepted || duplicate != nil {
		t.Fatal("per-source TLS handshake limit was not enforced")
	}
	second, accepted := listener.reserve(secondIP)
	if !accepted {
		t.Fatal("second source was rejected")
	}
	if overflow, accepted := listener.reserve(netip.MustParseAddr("192.0.2.3")); accepted ||
		overflow != nil {
		t.Fatal("global TLS handshake limit was not enforced")
	}
	first.release()
	if replacement, accepted := listener.reserve(firstIP); !accepted {
		t.Fatal("released TLS handshake capacity was not reusable")
	} else {
		replacement.release()
	}
	second.release()
}
