// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package telemetry

type Snapshot struct {
	Routes                       float64
	RouteTableReady              float64
	RouteSnapshotAgeSeconds      float64
	RouteRefreshFailures         float64
	RouteRejectedRoutes          float64
	TunnelSessions               float64
	TunnelSessionHeadroom        float64
	TunnelActiveStreams          float64
	TunnelQUICSessions           float64
	TunnelHTTP2Sessions          float64
	TunnelSmoothedRTTSeconds     float64
	TunnelBytesSent              float64
	TunnelBytesReceived          float64
	TunnelPacketsSent            float64
	TunnelPacketsReceived        float64
	TunnelPacketsLost            float64
	TunnelBindingFenceRejections float64
	HTTPRequests                 float64
	HTTPNoReadyBackendResponses  float64
	HTTPRequestHeadroom          float64
	HTTPConnections              float64
	HTTPConnectionHeadroom       float64
	HTTPStreams                  float64
	HTTPStreamHeadroom           float64
	TCPConnections               float64
	TCPConnectionHeadroom        float64
	UDPFlows                     float64
	UDPFlowHeadroom              float64
	UDPResponseQueueBytes        float64
	UDPResponseQueueRejections   float64
	UDPSockets                   float64
	UDPSocketReceiveBufferBytes  float64
	UDPSocketSendBufferBytes     float64
	UDPReceiveQueueBytes         float64
	UDPMaxReceiveQueueBytes      float64
	UDPKernelDrops               float64
	UsageQueueSamples            float64
	UsageQueueBytes              float64
	UsageQueueSampleHeadroom     float64
	UsageQueueByteHeadroom       float64
	UsageDiscardedIntervals      float64
	UsageDroppedRecords          float64
	AdmissionRateRejections      float64
	AdmissionCapacityRejections  float64
	AdmissionDrainRejections     float64
	SourceAdmissionEntries       float64
	SourceAdmissionEvictions     float64
	DatagramsDelivered           float64
	DatagramsDropped             float64
	DatagramsFailed              float64
	ServingReady                 float64
	PlacementEligible            float64
	TLSCertificateExpiry         float64
}

type Source interface {
	Snapshot() Snapshot
}

func BoolGauge(condition bool) float64 {
	if condition {
		return 1
	}
	return 0
}
