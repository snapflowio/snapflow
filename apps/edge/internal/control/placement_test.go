// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"testing"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

func TestEdgePlacementConstraintsUseOnlyEdgePermitsAndHysteresis(t *testing.T) {
	t.Parallel()
	profile := testEdgeCapacityProfile()
	healthy := apiclient.EdgeCapacitySnapshotDto{
		Tunnels:         80,
		HttpRequests:    80,
		HttpConnections: 80,
		HttpStreams:     80,
		TcpConnections:  80,
		UdpFlows:        80,
	}
	if len(edgePlacementConstraints(healthy, profile, placementConstraintSaturationRatio)) != 0 {
		t.Fatal("healthy edge capacity was placement constrained")
	}

	saturated := healthy
	saturated.HttpRequests = 91
	reasons := edgePlacementConstraints(
		saturated,
		profile,
		placementConstraintSaturationRatio,
	)
	if len(reasons) != 1 || reasons[0] != placementConstraintHTTPRequests {
		t.Fatalf("constraints = %v, want [%s]", reasons, placementConstraintHTTPRequests)
	}

	recovering := apiclient.EdgeCapacitySnapshotDto{
		Tunnels:         70,
		HttpRequests:    70,
		HttpConnections: 70,
		HttpStreams:     70,
		TcpConnections:  70,
		UdpFlows:        70,
	}
	if len(edgePlacementConstraints(recovering, profile, placementConstraintRecoveryRatio)) != 0 {
		t.Fatal("placement constraint did not clear below the recovery threshold")
	}
}

func TestHostTelemetryDoesNotConstrainPlacement(t *testing.T) {
	t.Parallel()
	current := apiclient.EdgeCapacitySnapshotDto{
		BytesPerSecondIn:  9_999_999,
		BytesPerSecondOut: 9_999_999,
		PacketsPerSecond:  9_999_999,
		CpuUtilization:    1,
		MemoryUtilization: 1,
		PacketDrops:       9_999_999,
	}
	if len(edgePlacementConstraints(current, testEdgeCapacityProfile(), placementConstraintSaturationRatio)) != 0 {
		t.Fatal("host telemetry constrained placement without exhausting edge permits")
	}
}

func TestPlacementConstraintRequiresSustainedPressureAndRecovery(t *testing.T) {
	t.Parallel()
	profile := testEdgeCapacityProfile()
	current := apiclient.EdgeCapacitySnapshotDto{HttpRequests: 95}
	detector := &placementConstraintDetector{}

	for sample := 1; sample < placementConstraintActivationSamples; sample++ {
		constrained, reasons := detector.observe(current, profile)
		if constrained {
			t.Fatalf("edge stopped placement after only %d constraint samples", sample)
		}
		if len(reasons) != 1 || reasons[0] != placementConstraintHTTPRequests {
			t.Fatalf("constraint reasons = %v, want [%s]", reasons, placementConstraintHTTPRequests)
		}
	}
	constrained, reasons := detector.observe(current, profile)
	if !constrained {
		t.Fatal("sustained edge permit pressure did not stop new placement")
	}
	if len(reasons) != 1 || reasons[0] != placementConstraintHTTPRequests {
		t.Fatalf("constraint reasons = %v, want [%s]", reasons, placementConstraintHTTPRequests)
	}

	for sample := 1; sample < placementConstraintRecoverySamples; sample++ {
		constrained, reasons = detector.observe(apiclient.EdgeCapacitySnapshotDto{}, profile)
		if !constrained {
			t.Fatalf("edge recovered after only %d healthy samples", sample)
		}
		if len(reasons) != 0 {
			t.Fatalf("healthy recovery sample reported constraints: %v", reasons)
		}
	}
	constrained, reasons = detector.observe(apiclient.EdgeCapacitySnapshotDto{}, profile)
	if constrained || len(reasons) != 0 {
		t.Fatalf("edge recovery = constrained %t, reasons %v", constrained, reasons)
	}
}

func TestCapacityProfileMustBeSupportedAndPositive(t *testing.T) {
	t.Parallel()
	if err := validateCapacityProfile(apiclient.EdgeCapacityProfileDto{}); err == nil {
		t.Fatal("zero capacity profile was accepted")
	}
	if err := validateCapacityProfile(testEdgeCapacityProfile()); err != nil {
		t.Fatalf("valid capacity profile rejected: %v", err)
	}
}

func testEdgeCapacityProfile() apiclient.EdgeCapacityProfileDto {
	return apiclient.EdgeCapacityProfileDto{
		Version:           edgeCapacityProfileVersion,
		Tunnels:           100,
		HttpRequests:      100,
		HttpConnections:   100,
		HttpStreams:       100,
		TcpConnections:    100,
		UdpFlows:          100,
		BytesPerSecondIn:  1,
		BytesPerSecondOut: 1,
		PacketsPerSecond:  1,
	}
}
