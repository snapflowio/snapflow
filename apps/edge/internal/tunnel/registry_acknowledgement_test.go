// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"testing"
)

func TestSessionAcknowledgementSignalsOncePerSession(t *testing.T) {
	t.Parallel()
	registry := &Registry{acknowledgementChanges: make(chan struct{}, 1)}
	first := &machineSession{}
	second := &machineSession{}

	registry.markAcknowledged(first)
	registry.markAcknowledged(first)
	assertAcknowledgementSignals(t, registry, 1)
	if !first.acknowledged.Load() {
		t.Fatal("session was not marked acknowledged")
	}

	registry.markAcknowledged(second)
	assertAcknowledgementSignals(t, registry, 1)
}

func TestSessionAcknowledgementSignalsCoalesceUntilReceived(t *testing.T) {
	t.Parallel()
	registry := &Registry{acknowledgementChanges: make(chan struct{}, 1)}

	registry.markAcknowledged(&machineSession{})
	registry.markAcknowledged(&machineSession{})
	assertAcknowledgementSignals(t, registry, 1)
}

func assertAcknowledgementSignals(t *testing.T, registry *Registry, want int) {
	t.Helper()
	received := 0
	for {
		select {
		case <-registry.BindingAcknowledgementChanges():
			received++
			continue
		default:
		}
		break
	}
	if received != want {
		t.Fatalf("acknowledgement signals = %d, want %d", received, want)
	}
}
