// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package telemetry

import "github.com/prometheus/client_golang/prometheus"

type metricDefinition struct {
	name        string
	help        string
	valueType   prometheus.ValueType
	value       func(Snapshot) float64
	description *prometheus.Desc
}

type metricsCollector struct {
	source      Source
	definitions []metricDefinition
}

func newMetricsCollector(source Source) *metricsCollector {
	definitions := []metricDefinition{
		gauge("routes", "Routes in the active last-known-good snapshot.", func(s Snapshot) float64 { return s.Routes }),
		gauge("route_table_ready", "One when the edge has a validated route table and zero before initial synchronization.", func(s Snapshot) float64 { return s.RouteTableReady }),
		gauge("route_snapshot_age_seconds", "Age of the active validated route snapshot; zero before initial synchronization.", func(s Snapshot) float64 { return s.RouteSnapshotAgeSeconds }),
		counter("route_refresh_failures_total", "Route refreshes rejected by the control plane, transport, or snapshot validation while retaining last-known-good state.", func(s Snapshot) float64 { return s.RouteRefreshFailures }),
		gauge("route_rejected_routes", "Routes in the current snapshot this Edge skipped because they could not be served.", func(s Snapshot) float64 { return s.RouteRejectedRoutes }),
		gauge("tunnel_sessions", "Authenticated Machine tunnel binding sessions.", func(s Snapshot) float64 { return s.TunnelSessions }),
		gauge("tunnel_session_headroom", "Remaining hard tunnel-session headroom.", func(s Snapshot) float64 { return s.TunnelSessionHeadroom }),
		gauge("tunnel_active_streams", "Active streams across authenticated Machine tunnel sessions.", func(s Snapshot) float64 { return s.TunnelActiveStreams }),
		gauge("tunnel_quic_sessions", "Authenticated Machine tunnel sessions using QUIC.", func(s Snapshot) float64 { return s.TunnelQUICSessions }),
		gauge("tunnel_http2_sessions", "Authenticated Machine tunnel sessions using HTTP/2 fallback.", func(s Snapshot) float64 { return s.TunnelHTTP2Sessions }),
		gauge("tunnel_smoothed_rtt_seconds", "Worst smoothed RTT among active Machine tunnel sessions.", func(s Snapshot) float64 { return s.TunnelSmoothedRTTSeconds }),
		gauge("tunnel_bytes_sent", "Bytes sent by currently active Machine tunnel sessions.", func(s Snapshot) float64 { return s.TunnelBytesSent }),
		gauge("tunnel_bytes_received", "Bytes received by currently active Machine tunnel sessions.", func(s Snapshot) float64 { return s.TunnelBytesReceived }),
		gauge("tunnel_packets_sent", "QUIC packets sent by currently active Machine tunnel sessions.", func(s Snapshot) float64 { return s.TunnelPacketsSent }),
		gauge("tunnel_packets_received", "QUIC packets received by currently active Machine tunnel sessions.", func(s Snapshot) float64 { return s.TunnelPacketsReceived }),
		gauge("tunnel_packets_lost", "QUIC packets reported lost by currently active Machine tunnel sessions.", func(s Snapshot) float64 { return s.TunnelPacketsLost }),
		counter("tunnel_binding_fence_rejections_total", "Tunnel handshakes, heartbeats, or datagrams rejected because their immutable Machine-Edge binding was stale or unauthorized.", func(s Snapshot) float64 { return s.TunnelBindingFenceRejections }),
		gauge("http_requests", "Active ordinary HTTP requests.", func(s Snapshot) float64 { return s.HTTPRequests }),
		counter("http_no_ready_backend_responses_total", "Matched HTTP requests rejected because no generation-fenced backend was ready.", func(s Snapshot) float64 { return s.HTTPNoReadyBackendResponses }),
		gauge("http_request_headroom", "Remaining hard ordinary HTTP request headroom.", func(s Snapshot) float64 { return s.HTTPRequestHeadroom }),
		gauge("http_connections", "Accepted downstream HTTP connections.", func(s Snapshot) float64 { return s.HTTPConnections }),
		gauge("http_connection_headroom", "Remaining hard downstream HTTP connection headroom.", func(s Snapshot) float64 { return s.HTTPConnectionHeadroom }),
		gauge("http_streams", "Active streaming or WebSocket HTTP requests.", func(s Snapshot) float64 { return s.HTTPStreams }),
		gauge("http_stream_headroom", "Remaining hard streaming or WebSocket HTTP request headroom.", func(s Snapshot) float64 { return s.HTTPStreamHeadroom }),
		gauge("tcp_connections", "Active proxied TCP connections.", func(s Snapshot) float64 { return s.TCPConnections }),
		gauge("tcp_connection_headroom", "Remaining hard TCP connection headroom.", func(s Snapshot) float64 { return s.TCPConnectionHeadroom }),
		gauge("udp_flows", "Active UDP client flows.", func(s Snapshot) float64 { return s.UDPFlows }),
		gauge("udp_flow_headroom", "Remaining hard UDP flow headroom.", func(s Snapshot) float64 { return s.UDPFlowHeadroom }),
		gauge("udp_response_queue_bytes", "Payload bytes retained in bounded UDP response queues.", func(s Snapshot) float64 { return s.UDPResponseQueueBytes }),
		counter("udp_response_queue_rejections_total", "UDP responses rejected because bounded response queues were saturated.", func(s Snapshot) float64 { return s.UDPResponseQueueRejections }),
		gauge("udp_sockets", "Active public UDP ingress sockets.", func(s Snapshot) float64 { return s.UDPSockets }),
		gauge("udp_socket_receive_buffer_bytes", "Smallest effective receive buffer among public UDP sockets.", func(s Snapshot) float64 { return s.UDPSocketReceiveBufferBytes }),
		gauge("udp_socket_send_buffer_bytes", "Smallest effective send buffer among public UDP sockets.", func(s Snapshot) float64 { return s.UDPSocketSendBufferBytes }),
		gauge("udp_receive_queue_bytes", "Payload bytes waiting in kernel UDP receive queues.", func(s Snapshot) float64 { return s.UDPReceiveQueueBytes }),
		gauge("udp_max_receive_queue_bytes", "Largest current kernel receive queue among public UDP sockets.", func(s Snapshot) float64 { return s.UDPMaxReceiveQueueBytes }),
		counter("udp_kernel_drops_total", "Packets dropped by public UDP sockets before user-space processing.", func(s Snapshot) float64 { return s.UDPKernelDrops }),
		gauge("usage_queue_samples", "Durable usage samples waiting for Snapflow API ingestion.", func(s Snapshot) float64 { return s.UsageQueueSamples }),
		gauge("usage_queue_bytes", "Bytes retained by durable usage batches.", func(s Snapshot) float64 { return s.UsageQueueBytes }),
		gauge("usage_queue_sample_headroom", "Remaining durable usage queue sample capacity.", func(s Snapshot) float64 { return s.UsageQueueSampleHeadroom }),
		gauge("usage_queue_byte_headroom", "Remaining durable usage queue byte capacity.", func(s Snapshot) float64 { return s.UsageQueueByteHeadroom }),
		counter("usage_discarded_intervals_total", "Usage intervals the Snapflow API permanently rejected and the Edge discarded.", func(s Snapshot) float64 { return s.UsageDiscardedIntervals }),
		counter("usage_dropped_records_total", "Usage records dropped because no metered backend identity was available.", func(s Snapshot) float64 { return s.UsageDroppedRecords }),
		counter("admission_rate_rejections_total", "Admissions rejected by source or global rate limits.", func(s Snapshot) float64 { return s.AdmissionRateRejections }),
		counter("admission_capacity_rejections_total", "Admissions rejected by concurrency limits.", func(s Snapshot) float64 { return s.AdmissionCapacityRejections }),
		counter("admission_drain_rejections_total", "Admissions rejected while draining.", func(s Snapshot) float64 { return s.AdmissionDrainRejections }),
		gauge("source_admission_entries", "Bounded source-address admission entries.", func(s Snapshot) float64 { return s.SourceAdmissionEntries }),
		counter("source_admission_evictions_total", "Source-address admission entries evicted at capacity.", func(s Snapshot) float64 { return s.SourceAdmissionEvictions }),
		counter("datagrams_delivered_total", "Reassembled tunnel datagrams delivered to UDP flows.", func(s Snapshot) float64 { return s.DatagramsDelivered }),
		counter("datagrams_dropped_total", "Datagrams dropped because dispatch queues were saturated.", func(s Snapshot) float64 { return s.DatagramsDropped }),
		counter("datagrams_failed_total", "Datagrams rejected or failed during delivery.", func(s Snapshot) float64 { return s.DatagramsFailed }),
		gauge("serving_ready", "One when the edge has a validated route table and is not draining existing route traffic.", func(s Snapshot) float64 { return s.ServingReady }),
		gauge("placement_eligible", "One when the control plane may place additional routes on this edge based on edge-owned hard permits.", func(s Snapshot) float64 { return s.PlacementEligible }),
		gauge("tls_certificate_expiry_timestamp_seconds", "Unix timestamp when the active edge TLS leaf certificate expires.", func(s Snapshot) float64 { return s.TLSCertificateExpiry }),
	}
	for index := range definitions {
		definition := &definitions[index]
		definition.description = prometheus.NewDesc(
			"snapflow_edge_"+definition.name,
			definition.help,
			nil,
			nil,
		)
	}
	return &metricsCollector{source: source, definitions: definitions}
}

func (collector *metricsCollector) Describe(output chan<- *prometheus.Desc) {
	for _, definition := range collector.definitions {
		output <- definition.description
	}
}

func (collector *metricsCollector) Collect(output chan<- prometheus.Metric) {
	snapshot := collector.source.Snapshot()
	for _, definition := range collector.definitions {
		output <- prometheus.MustNewConstMetric(
			definition.description,
			definition.valueType,
			definition.value(snapshot),
		)
	}
}

func gauge(
	name string,
	help string,
	value func(Snapshot) float64,
) metricDefinition {
	return metricDefinition{
		name: name, help: help, valueType: prometheus.GaugeValue, value: value,
	}
}

func counter(
	name string,
	help string,
	value func(Snapshot) float64,
) metricDefinition {
	return metricDefinition{
		name: name, help: help, valueType: prometheus.CounterValue, value: value,
	}
}
