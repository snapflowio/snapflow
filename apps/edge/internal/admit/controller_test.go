// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package admit

import (
	"net/netip"
	"testing"
)

const (
	testGlobalPermits      = 4
	testInteractiveReserve = 1
	testPerScopePermits    = 2
	testRate               = 1_000
	testSourceEntries      = 16
)

func firstSource() netip.Addr { return netip.MustParseAddr("192.0.2.1") }

func secondSource() netip.Addr { return netip.MustParseAddr("192.0.2.2") }

func thirdSource() netip.Addr { return netip.MustParseAddr("192.0.2.3") }

func testLimits() Limits {
	limits := ProductionLimits()
	limits.HTTPPerSourceRate, limits.HTTPPerSourceBurst = testRate, testRate
	limits.HTTPGlobalRate, limits.HTTPGlobalBurst = testRate, testRate
	limits.HTTPSourceEntries = testSourceEntries
	limits.HTTPRequests = testGlobalPermits
	limits.HTTPRequestsInteractiveReserve = testInteractiveReserve
	limits.HTTPRequestsPerSource = testPerScopePermits
	limits.HTTPRequestsPerOwner = testGlobalPermits
	limits.HTTPRequestsPerRoute = testGlobalPermits
	limits.HTTPRequestsPerBinding = testGlobalPermits
	return limits
}

func newTestController(t *testing.T, limits Limits) *Controller {
	t.Helper()
	controller, err := New(WithLimits(limits))
	if err != nil {
		t.Fatalf("create admission controller: %v", err)
	}
	return controller
}

func TestPerSourcePermitsAreReleasedExactlyOnce(t *testing.T) {
	t.Parallel()
	controller := newTestController(t, testLimits())
	permits := make([]*Permit, 0, testPerScopePermits)
	for range testPerScopePermits {
		permit, result := controller.AdmitHTTP(firstSource(), Scope{}, false)
		if result != ResultAllowed {
			t.Fatalf("admission within the per-source limit = %d", result)
		}
		permits = append(permits, permit)
	}
	if _, result := controller.AdmitHTTP(firstSource(), Scope{}, false); result != ResultCapacity {
		t.Fatalf("admission beyond the per-source limit = %d, want capacity", result)
	}
	permits[0].Release()
	permits[0].Release()
	if counters := controller.Snapshot(); counters.HTTPRequestActive != testPerScopePermits-1 ||
		counters.CapacityRejected != 1 {
		t.Fatalf("counters = %+v, want one released permit and one capacity rejection", counters)
	}
	if _, result := controller.AdmitHTTP(firstSource(), Scope{}, false); result != ResultAllowed {
		t.Fatalf("admission after release = %d", result)
	}
}

func TestInteractiveReserveIsHeldBackFromOtherWork(t *testing.T) {
	t.Parallel()
	controller := newTestController(t, testLimits())
	for _, source := range []netip.Addr{firstSource(), firstSource(), secondSource()} {
		if _, result := controller.AdmitHTTP(source, Scope{}, false); result != ResultAllowed {
			t.Fatalf("non-interactive admission outside the reserve = %d", result)
		}
	}
	if _, result := controller.AdmitHTTP(thirdSource(), Scope{}, false); result != ResultCapacity {
		t.Fatalf("non-interactive admission into the reserve = %d, want capacity", result)
	}
	if _, result := controller.AdmitHTTP(thirdSource(), Scope{Interactive: true}, false); result != ResultAllowed {
		t.Fatalf("interactive admission into the reserve = %d", result)
	}
}

func TestDrainingRejectsNewWorkButNotExistingUDPFlows(t *testing.T) {
	t.Parallel()
	controller := newTestController(t, testLimits())
	controller.BeginDrain()
	if _, result := controller.AdmitHTTP(firstSource(), Scope{}, false); result != ResultDraining {
		t.Fatalf("HTTP admission while draining = %d", result)
	}
	if _, result := controller.AdmitTCP(firstSource(), Scope{}); result != ResultDraining {
		t.Fatalf("TCP admission while draining = %d", result)
	}
	if result := controller.AllowUDP(firstSource(), true); result != ResultDraining {
		t.Fatalf("new UDP flow while draining = %d", result)
	}
	if result := controller.AllowUDP(firstSource(), false); result != ResultAllowed {
		t.Fatalf("existing UDP flow packet while draining = %d", result)
	}
	if counters := controller.Snapshot(); counters.DrainRejected != 3 {
		t.Fatalf("drain rejections = %d, want 3", counters.DrainRejected)
	}
}

func TestSourceRateLimitRejectsAfterTheBurst(t *testing.T) {
	t.Parallel()
	limits := testLimits()
	limits.HTTPPerSourceRate, limits.HTTPPerSourceBurst = 1, 1
	controller := newTestController(t, limits)
	permit, result := controller.AdmitHTTP(firstSource(), Scope{}, false)
	if result != ResultAllowed {
		t.Fatalf("first request = %d", result)
	}
	permit.Release()
	if _, result := controller.AdmitHTTP(firstSource(), Scope{}, false); result != ResultRateLimited {
		t.Fatalf("request beyond the source burst = %d, want rate limited", result)
	}
	if _, result := controller.AdmitHTTP(secondSource(), Scope{}, false); result != ResultAllowed {
		t.Fatalf("another source was charged for the first source's burst: %d", result)
	}
}

func TestLimitsRejectReserveAtOrAboveTheGlobalLimit(t *testing.T) {
	t.Parallel()
	limits := testLimits()
	limits.HTTPRequestsInteractiveReserve = limits.HTTPRequests
	if _, err := New(WithLimits(limits)); err == nil {
		t.Fatal("an interactive reserve covering all capacity was accepted")
	}
}

func TestNewDefaultsToProductionLimits(t *testing.T) {
	t.Parallel()
	controller, err := New()
	if err != nil {
		t.Fatalf("create admission controller: %v", err)
	}
	if controller.limits != ProductionLimits() {
		t.Fatalf("default limits = %+v, want production limits", controller.limits)
	}
}
