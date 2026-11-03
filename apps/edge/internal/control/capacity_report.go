// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"strconv"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const counterBase = 10

func (coordinator *Coordinator) capacitySnapshot() apiclient.EdgeCapacitySnapshotDto {
	hostSample, hostErr := coordinator.host.Sample()
	if hostErr != nil {
		coordinator.hostAvailability.Failure(hostSamplingOperation, hostErr)
	} else {
		coordinator.hostAvailability.Success(hostSamplingOperation)
	}
	operational := coordinator.status.OperationalMetrics()
	return apiclient.EdgeCapacitySnapshotDto{
		Version: edgeCapacityProfileVersion,
		PlacementEligible: coordinator.accepting.Load() &&
			coordinator.status.Ready() &&
			!coordinator.placementConstrained.Load(),
		RouteCount:                  operational.RouteCount,
		Tunnels:                     coordinator.status.SessionCount(),
		TunnelHeadroom:              operational.TunnelHeadroom,
		HttpRequests:                operational.HTTPRequests,
		HttpRequestHeadroom:         operational.HTTPRequestHeadroom,
		HttpConnections:             operational.HTTPConnections,
		HttpConnectionHeadroom:      operational.HTTPConnectionHeadroom,
		HttpStreams:                 operational.HTTPStreams,
		HttpStreamHeadroom:          operational.HTTPStreamHeadroom,
		TcpConnections:              coordinator.status.TCPConnectionCount(),
		TcpConnectionHeadroom:       operational.TCPConnectionHeadroom,
		UdpFlows:                    coordinator.status.FlowCount(),
		UdpFlowHeadroom:             operational.UDPFlowHeadroom,
		BytesPerSecondIn:            hostSample.BytesPerSecondIn,
		BytesPerSecondOut:           hostSample.BytesPerSecondOut,
		PacketsPerSecond:            hostSample.PacketsPerSecond,
		CpuUtilization:              hostSample.CPUUtilization,
		MemoryUtilization:           hostSample.MemoryUtilization,
		PacketDrops:                 hostSample.PacketDrops,
		AdmissionRateRejections:     formatCounter(operational.AdmissionRateRejections),
		AdmissionCapacityRejections: formatCounter(operational.AdmissionCapacityRejections),
		AdmissionDrainRejections:    formatCounter(operational.AdmissionDrainRejections),
		SourceAdmissionEntries:      operational.SourceAdmissionEntries,
		SourceAdmissionEvictions:    formatCounter(operational.SourceAdmissionEvictions),
		DatagramsDelivered:          formatCounter(operational.DatagramsDelivered),
		DatagramsDropped:            formatCounter(operational.DatagramsDropped),
		DatagramsFailed:             formatCounter(operational.DatagramsFailed),
	}
}

func formatCounter(value uint64) string {
	return strconv.FormatUint(value, counterBase)
}
