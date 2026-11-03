// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"time"

	"github.com/snapflowio/edge/internal/telemetry"
)

func (assembled *assembly) Snapshot() telemetry.Snapshot {
	operational := assembled.OperationalMetrics()
	snapshot := assembled.routes.Load()
	tunnelCounters := assembled.tunnels.TunnelCounters()
	socketMetrics := assembled.udp.Sockets().Snapshot()
	usageSnapshot := assembled.meter.Snapshot()
	httpFailures := assembled.http.FailureCounters()
	servingReady := assembled.servingReady()
	return telemetry.Snapshot{
		Routes:                       float64(operational.RouteCount),
		RouteTableReady:              telemetry.BoolGauge(assembled.Ready()),
		RouteSnapshotAgeSeconds:      assembled.routes.SnapshotAge(time.Now()).Seconds(),
		RouteRefreshFailures:         float64(assembled.routes.RefreshFailures()),
		RouteRejectedRoutes:          float64(len(snapshot.RejectedRoutes())),
		TunnelSessions:               float64(assembled.SessionCount()),
		TunnelSessionHeadroom:        float64(operational.TunnelHeadroom),
		TunnelActiveStreams:          float64(tunnelCounters.ActiveStreams),
		TunnelQUICSessions:           float64(tunnelCounters.QUICSessions),
		TunnelHTTP2Sessions:          float64(tunnelCounters.HTTP2Sessions),
		TunnelSmoothedRTTSeconds:     tunnelCounters.SmoothedRTT.Seconds(),
		TunnelBytesSent:              float64(tunnelCounters.BytesSent),
		TunnelBytesReceived:          float64(tunnelCounters.BytesReceived),
		TunnelPacketsSent:            float64(tunnelCounters.PacketsSent),
		TunnelPacketsReceived:        float64(tunnelCounters.PacketsReceived),
		TunnelPacketsLost:            float64(tunnelCounters.PacketsLost),
		TunnelBindingFenceRejections: float64(tunnelCounters.BindingFenceRejections),
		HTTPRequests:                 float64(operational.HTTPRequests),
		HTTPNoReadyBackendResponses:  float64(httpFailures.NoReadyBackend),
		HTTPRequestHeadroom:          float64(operational.HTTPRequestHeadroom),
		HTTPConnections:              float64(operational.HTTPConnections),
		HTTPConnectionHeadroom:       float64(operational.HTTPConnectionHeadroom),
		HTTPStreams:                  float64(operational.HTTPStreams),
		HTTPStreamHeadroom:           float64(operational.HTTPStreamHeadroom),
		TCPConnections:               float64(assembled.TCPConnectionCount()),
		TCPConnectionHeadroom:        float64(operational.TCPConnectionHeadroom),
		UDPFlows:                     float64(assembled.FlowCount()),
		UDPFlowHeadroom:              float64(operational.UDPFlowHeadroom),
		UDPResponseQueueBytes:        float64(assembled.udp.QueuedResponseBytes()),
		UDPResponseQueueRejections:   float64(assembled.udp.ResponseQueueRejections()),
		UDPSockets:                   float64(socketMetrics.Sockets),
		UDPSocketReceiveBufferBytes:  float64(socketMetrics.MinimumReceiveBufferBytes),
		UDPSocketSendBufferBytes:     float64(socketMetrics.MinimumSendBufferBytes),
		UDPReceiveQueueBytes:         float64(socketMetrics.ReceiveQueueBytes),
		UDPMaxReceiveQueueBytes:      float64(socketMetrics.MaximumReceiveQueueBytes),
		UDPKernelDrops:               float64(socketMetrics.KernelDrops),
		UsageQueueSamples:            float64(usageSnapshot.Samples),
		UsageQueueBytes:              float64(usageSnapshot.Bytes),
		UsageQueueSampleHeadroom:     float64(usageSnapshot.SampleHeadroom),
		UsageQueueByteHeadroom:       float64(usageSnapshot.ByteHeadroom),
		UsageDiscardedIntervals:      float64(usageSnapshot.DiscardedIntervals),
		UsageDroppedRecords:          float64(usageSnapshot.DroppedRecords),
		AdmissionRateRejections:      float64(operational.AdmissionRateRejections),
		AdmissionCapacityRejections:  float64(operational.AdmissionCapacityRejections),
		AdmissionDrainRejections:     float64(operational.AdmissionDrainRejections),
		SourceAdmissionEntries:       float64(operational.SourceAdmissionEntries),
		SourceAdmissionEvictions:     float64(operational.SourceAdmissionEvictions),
		DatagramsDelivered:           float64(operational.DatagramsDelivered),
		DatagramsDropped:             float64(operational.DatagramsDropped),
		DatagramsFailed:              float64(operational.DatagramsFailed),
		ServingReady:                 telemetry.BoolGauge(servingReady),
		PlacementEligible:            telemetry.BoolGauge(servingReady && !assembled.coordinator.PlacementConstrained()),
		TLSCertificateExpiry:         float64(assembled.certificates.ExpiresAt().Unix()),
	}
}
