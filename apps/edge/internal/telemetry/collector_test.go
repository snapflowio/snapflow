// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package telemetry

import (
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
)

type staticSource struct {
	snapshot Snapshot
}

func (source staticSource) Snapshot() Snapshot {
	return source.snapshot
}

func TestCollectorExportsCapacityAndSaturationMetrics(t *testing.T) {
	t.Parallel()
	collector := newMetricsCollector(staticSource{snapshot: Snapshot{
		Routes:                       12,
		RouteTableReady:              1,
		RouteSnapshotAgeSeconds:      9,
		RouteRefreshFailures:         5,
		TunnelSessions:               8,
		TunnelSessionHeadroom:        92,
		TunnelBindingFenceRejections: 2,
		HTTPNoReadyBackendResponses:  4,
		UDPFlows:                     40,
		UDPFlowHeadroom:              960,
		UsageQueueSamples:            11,
		UsageQueueByteHeadroom:       1024,
		AdmissionCapacityRejections:  3,
		DatagramsDropped:             7,
		ServingReady:                 1,
		PlacementEligible:            1,
	}})
	registry := prometheus.NewRegistry()
	if err := registry.Register(collector); err != nil {
		t.Fatalf("register collector: %v", err)
	}
	expected := `
# HELP snapflow_edge_routes Routes in the active last-known-good snapshot.
# TYPE snapflow_edge_routes gauge
snapflow_edge_routes 12
# HELP snapflow_edge_route_table_ready One when the edge has a validated route table and zero before initial synchronization.
# TYPE snapflow_edge_route_table_ready gauge
snapflow_edge_route_table_ready 1
# HELP snapflow_edge_route_snapshot_age_seconds Age of the active validated route snapshot; zero before initial synchronization.
# TYPE snapflow_edge_route_snapshot_age_seconds gauge
snapflow_edge_route_snapshot_age_seconds 9
# HELP snapflow_edge_route_refresh_failures_total Route refreshes rejected by the control plane, transport, or snapshot validation while retaining last-known-good state.
# TYPE snapflow_edge_route_refresh_failures_total counter
snapflow_edge_route_refresh_failures_total 5
# HELP snapflow_edge_tunnel_sessions Authenticated Machine tunnel binding sessions.
# TYPE snapflow_edge_tunnel_sessions gauge
snapflow_edge_tunnel_sessions 8
# HELP snapflow_edge_tunnel_session_headroom Remaining hard tunnel-session headroom.
# TYPE snapflow_edge_tunnel_session_headroom gauge
snapflow_edge_tunnel_session_headroom 92
# HELP snapflow_edge_tunnel_binding_fence_rejections_total Tunnel handshakes, heartbeats, or datagrams rejected because their immutable Machine-Edge binding was stale or unauthorized.
# TYPE snapflow_edge_tunnel_binding_fence_rejections_total counter
snapflow_edge_tunnel_binding_fence_rejections_total 2
# HELP snapflow_edge_http_no_ready_backend_responses_total Matched HTTP requests rejected because no generation-fenced backend was ready.
# TYPE snapflow_edge_http_no_ready_backend_responses_total counter
snapflow_edge_http_no_ready_backend_responses_total 4
# HELP snapflow_edge_udp_flows Active UDP client flows.
# TYPE snapflow_edge_udp_flows gauge
snapflow_edge_udp_flows 40
# HELP snapflow_edge_udp_flow_headroom Remaining hard UDP flow headroom.
# TYPE snapflow_edge_udp_flow_headroom gauge
snapflow_edge_udp_flow_headroom 960
# HELP snapflow_edge_usage_queue_samples Durable usage samples waiting for Snapflow API ingestion.
# TYPE snapflow_edge_usage_queue_samples gauge
snapflow_edge_usage_queue_samples 11
# HELP snapflow_edge_usage_queue_byte_headroom Remaining durable usage queue byte capacity.
# TYPE snapflow_edge_usage_queue_byte_headroom gauge
snapflow_edge_usage_queue_byte_headroom 1024
# HELP snapflow_edge_admission_capacity_rejections_total Admissions rejected by concurrency limits.
# TYPE snapflow_edge_admission_capacity_rejections_total counter
snapflow_edge_admission_capacity_rejections_total 3
# HELP snapflow_edge_datagrams_dropped_total Datagrams dropped because dispatch queues were saturated.
# TYPE snapflow_edge_datagrams_dropped_total counter
snapflow_edge_datagrams_dropped_total 7
# HELP snapflow_edge_serving_ready One when the edge has a validated route table and is not draining existing route traffic.
# TYPE snapflow_edge_serving_ready gauge
snapflow_edge_serving_ready 1
# HELP snapflow_edge_placement_eligible One when the control plane may place additional routes on this edge based on edge-owned hard permits.
# TYPE snapflow_edge_placement_eligible gauge
snapflow_edge_placement_eligible 1
`
	names := []string{
		"snapflow_edge_routes",
		"snapflow_edge_route_table_ready",
		"snapflow_edge_route_snapshot_age_seconds",
		"snapflow_edge_route_refresh_failures_total",
		"snapflow_edge_tunnel_sessions",
		"snapflow_edge_tunnel_session_headroom",
		"snapflow_edge_tunnel_binding_fence_rejections_total",
		"snapflow_edge_http_no_ready_backend_responses_total",
		"snapflow_edge_udp_flows",
		"snapflow_edge_udp_flow_headroom",
		"snapflow_edge_usage_queue_samples",
		"snapflow_edge_usage_queue_byte_headroom",
		"snapflow_edge_admission_capacity_rejections_total",
		"snapflow_edge_datagrams_dropped_total",
		"snapflow_edge_serving_ready",
		"snapflow_edge_placement_eligible",
	}
	if err := testutil.GatherAndCompare(registry, strings.NewReader(expected), names...); err != nil {
		t.Fatal(err)
	}
}
