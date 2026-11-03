// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package udp

import (
	"sync/atomic"
	"testing"
	"time"
)

const (
	testClientBytes = 100
	testRouteLimit  = 2
)

func TestResponsesStayWithinTheAmplificationBudget(t *testing.T) {
	t.Parallel()
	flow := &peerFlow{}
	if !flow.reserveResponse(initialAmplificationAllowance) {
		t.Fatal("the initial response allowance was refused")
	}
	if flow.reserveResponse(1) {
		t.Fatal("a response beyond the allowance was accepted before the client sent data")
	}
	flow.requestBytes.Add(testClientBytes)
	if !flow.reserveResponse(testClientBytes * amplificationResponseRatio) {
		t.Fatal("client bytes did not extend the response budget")
	}
	flow.releaseResponse(testClientBytes)
	if !flow.reserveResponse(testClientBytes) {
		t.Fatal("released response bytes were not returned to the budget")
	}
}

func TestListenerGroupEnforcesFlowAndPacketLimits(t *testing.T) {
	t.Parallel()
	group := &listenerGroup{flowLimit: testRouteLimit, packetLimit: testRouteLimit}
	for range testRouteLimit {
		if !group.reserveFlow() {
			t.Fatal("a flow within the route limit was refused")
		}
	}
	if group.reserveFlow() {
		t.Fatal("a flow beyond the route limit was accepted")
	}
	group.releaseFlow()
	if !group.reserveFlow() {
		t.Fatal("a released flow slot was not reusable")
	}
	now := time.Now()
	for range testRouteLimit {
		if !group.allowPacket(now) {
			t.Fatal("a packet within the rate was refused")
		}
	}
	if group.allowPacket(now) {
		t.Fatal("a packet beyond the rate was accepted")
	}
	if !group.allowPacket(now.Add(packetRateWindow)) {
		t.Fatal("the packet rate window did not reset")
	}
}

func TestByteCapacityReservationIsBounded(t *testing.T) {
	t.Parallel()
	var counter atomic.Int64
	if !reserveByteCapacity(&counter, testClientBytes, testClientBytes) {
		t.Fatal("a reservation equal to the limit was refused")
	}
	if reserveByteCapacity(&counter, testClientBytes, 1) {
		t.Fatal("a reservation beyond the limit was accepted")
	}
	releaseByteCapacity(&counter, testClientBytes)
	if counter.Load() != 0 {
		t.Fatalf("released capacity = %d, want 0", counter.Load())
	}
}
