// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

func TestRouteSnapshotDigestMatchesTypeScriptCanonicalVector(t *testing.T) {
	t.Parallel()
	generatedAt := time.Date(2026, time.September, 1, 12, 0, 0, 0, time.UTC)
	table := &apiclient.EdgeRouteSnapshotDto{
		EdgeId:                uuid.MustParse("11111111-1111-4111-8111-111111111111"),
		EdgeSessionGeneration: 3,
		Version:               "7",
		GeneratedAt:           generatedAt,
		ExpiresAt:             generatedAt.Add(45 * time.Second),
		TrustedHttpProxyCidrs: []string{},
		MachineBindings:       []apiclient.EdgeMachineBindingDto{},
		HttpRoutes:            []apiclient.EdgeHttpRouteDto{},
		TcpRoutes:             []apiclient.EdgeTcpRouteDto{},
		UdpRoutes:             []apiclient.EdgeUdpRouteDto{},
	}
	digest, err := SnapshotDigest(table)
	if err != nil {
		t.Fatalf("calculate route snapshot digest: %v", err)
	}
	if digest != expectedEmptySnapshotDigest {
		t.Fatalf("digest = %s, want TypeScript vector %s", digest, expectedEmptySnapshotDigest)
	}
}

func TestRouteSnapshotDigestMatchesTypeScriptRouteVector(t *testing.T) {
	t.Parallel()
	var (
		machineID  = uuid.MustParse("22222222-2222-4222-8222-222222222222")
		bindingID  = uuid.MustParse("33333333-3333-4333-8333-333333333333")
		ownerID    = uuid.MustParse("55555555-5555-4555-8555-555555555555")
		exposureID = uuid.MustParse("66666666-6666-4666-8666-666666666666")
	)
	const (
		sandboxID         = "sandbox-ü"
		exposureName      = "web <ü> &   \U0001F680"
		publicHost        = "app.example.test"
		vectorDigest      = "70b3d78c4f5e8f3f485f2d639edf5f3974bd9cbb915f52ac14b687706127afe0"
		maximumRevision   = 2_147_483_647
		maximumBodyBytes  = 1 << 30
		routeTargetPort   = 8080
		assignmentVersion = 9
	)
	generatedAt := time.Date(2026, time.September, 1, 12, 0, 0, 0, time.UTC)
	leaseExpiry := generatedAt.Add(50 * time.Second)
	table := &apiclient.EdgeRouteSnapshotDto{
		EdgeId:                uuid.MustParse("11111111-1111-4111-8111-111111111111"),
		EdgeSessionGeneration: 3,
		Version:               "42",
		GeneratedAt:           generatedAt,
		ExpiresAt:             generatedAt.Add(45 * time.Second),
		TrustedHttpProxyCidrs: []string{"192.0.2.0/24"},
		MachineBindings: []apiclient.EdgeMachineBindingDto{{
			MachineId:                machineID,
			MachineSessionGeneration: 4,
			BindingId:                bindingID,
			BindingRevision:          maximumRevision,
			BindingDigest:            strings.Repeat("b", 64),
			LeaseExpiresAt:           generatedAt.Add(time.Minute),
		}},
		HttpRoutes: []apiclient.EdgeHttpRouteDto{{
			BackendId: uuid.MustParse("44444444-4444-4444-8444-444444444444"), State: apiclient.ExposureBackendStateActive,
			MachineId: machineID, OwnerId: ownerID, BindingId: bindingID, Interactive: true,
			AssignmentGeneration: assignmentVersion, ExposureGeneration: 2, SandboxId: sandboxID,
			ExposureId: exposureID, ExposureName: exposureName, PublicHost: publicHost,
			TargetHost: "runtime", TargetPort: routeTargetPort, LeaseExpiresAt: leaseExpiry,
			Protocol: "http", TrafficWeight: 100,
			Hostnames: []string{publicHost, "xn--bcher-kva.example"},
			Policy: apiclient.EdgeHttpRoutePolicyDto{
				Visibility: apiclient.ExposureVisibilityProtected, Path: "/a&b",
				StripPath: true, RequireTrustedProxy: true, MaxBodyBytes: maximumBodyBytes,
				ReadTimeoutSeconds: 30, Retries: 5,
				UpstreamProtocol: apiclient.HttpUpstreamProtocolH2c,
				AllowedOrigins:   []string{"https://example.com/?a=1&b=2"},
				AllowCredentials: true,
			},
		}},
		TcpRoutes: []apiclient.EdgeTcpRouteDto{{
			BackendId: uuid.MustParse("77777777-7777-4777-8777-777777777777"), State: apiclient.ExposureBackendStateActive,
			MachineId: machineID, OwnerId: ownerID, BindingId: bindingID, Interactive: true,
			AssignmentGeneration: assignmentVersion, ExposureGeneration: 2, SandboxId: sandboxID,
			ExposureId: exposureID, ExposureName: exposureName, PublicHost: publicHost,
			TargetHost: "runtime", TargetPort: routeTargetPort, LeaseExpiresAt: leaseExpiry,
			Protocol: "tcp", PublicPort: 10_022,
			Policy: apiclient.EdgeTcpRoutePolicyDto{
				ProxyProtocol: apiclient.ProxyProtocolV2, IdleTimeoutSeconds: 600, ConnectionLimit: 1_000_000,
			},
		}},
		UdpRoutes: []apiclient.EdgeUdpRouteDto{{
			BackendId: uuid.MustParse("88888888-8888-4888-8888-888888888888"), State: apiclient.ExposureBackendStateActive,
			MachineId: machineID, OwnerId: ownerID, BindingId: bindingID, Interactive: true,
			AssignmentGeneration: assignmentVersion, ExposureGeneration: 2, SandboxId: sandboxID,
			ExposureId: exposureID, ExposureName: exposureName, PublicHost: publicHost,
			TargetHost: "runtime", TargetPort: routeTargetPort, LeaseExpiresAt: leaseExpiry,
			Protocol: "udp", PublicPort: 10_053,
			Policy: apiclient.EdgeUdpRoutePolicyDto{
				IdleTimeoutSeconds: 60, FlowLimit: 100, PacketsPerSecond: 5_000, MaximumDatagramPayloadBytes: 1_200,
			},
		}},
	}
	digest, err := SnapshotDigest(table)
	if err != nil {
		t.Fatalf("calculate route snapshot digest: %v", err)
	}
	if digest != vectorDigest {
		t.Fatalf("digest = %s, want TypeScript vector %s", digest, vectorDigest)
	}
}
