// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package plan

import (
	"testing"

	"github.com/snapflowio/tunnel-go/protocol"
)

func TestValidateTargetHostAcceptsRelayedGuestServices(t *testing.T) {
	for service := range relayedGuestServices() {
		if err := validateTargetHost(RuntimeTargetHost, protocol.ProtocolHTTP, "", service); err != nil {
			t.Fatalf("guest service %q rejected: %v", service, err)
		}
	}
}

func TestValidateTargetHostRejectsInvalidGuestServices(t *testing.T) {
	tests := map[string]struct {
		protocol protocol.Protocol
		service  string
	}{
		"unknown service":    {protocol: protocol.ProtocolHTTP, service: "metrics"},
		"non-HTTP transport": {protocol: protocol.ProtocolTCP, service: "desktop"},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			if err := validateTargetHost(RuntimeTargetHost, test.protocol, "", test.service); err == nil {
				t.Fatalf("guest service %q over %v accepted", test.service, test.protocol)
			}
		})
	}
}
