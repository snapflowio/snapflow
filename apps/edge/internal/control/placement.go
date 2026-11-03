// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"errors"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	placementConstraintSaturationRatio   = 0.90
	placementConstraintRecoveryRatio     = 0.75
	placementConstraintActivationSamples = 3
	placementConstraintRecoverySamples   = 2
	edgeCapacityProfileVersion           = 1
)

const (
	placementConstraintTunnels         = "tunnels"
	placementConstraintHTTPRequests    = "http_requests"
	placementConstraintHTTPConnections = "http_connections"
	placementConstraintHTTPStreams     = "http_streams"
	placementConstraintTCPConnections  = "tcp_connections"
	placementConstraintUDPFlows        = "udp_flows"
)

type placementConstraintDetector struct {
	pressured        bool
	saturatedSamples int
	recoveredSamples int
}

type permitUsage struct {
	reason  string
	current int32
	limit   int32
}

func (detector *placementConstraintDetector) observe(
	current apiclient.EdgeCapacitySnapshotDto,
	profile apiclient.EdgeCapacityProfileDto,
) (bool, []string) {
	ratio := placementConstraintSaturationRatio
	if detector.pressured {
		ratio = placementConstraintRecoveryRatio
	}
	reasons := edgePlacementConstraints(current, profile, ratio)
	if len(reasons) > 0 {
		detector.recoveredSamples = 0
		if detector.pressured {
			return true, reasons
		}
		detector.saturatedSamples++
		if detector.saturatedSamples >= placementConstraintActivationSamples {
			detector.pressured = true
		}
		return detector.pressured, reasons
	}

	detector.saturatedSamples = 0
	if !detector.pressured {
		return false, nil
	}
	detector.recoveredSamples++
	if detector.recoveredSamples >= placementConstraintRecoverySamples {
		detector.pressured = false
		detector.recoveredSamples = 0
	}
	return detector.pressured, nil
}

func edgePlacementConstraints(
	current apiclient.EdgeCapacitySnapshotDto,
	profile apiclient.EdgeCapacityProfileDto,
	ratio float64,
) []string {
	permits := [...]permitUsage{
		{placementConstraintTunnels, current.Tunnels, profile.Tunnels},
		{placementConstraintHTTPRequests, current.HttpRequests, profile.HttpRequests},
		{placementConstraintHTTPConnections, current.HttpConnections, profile.HttpConnections},
		{placementConstraintHTTPStreams, current.HttpStreams, profile.HttpStreams},
		{placementConstraintTCPConnections, current.TcpConnections, profile.TcpConnections},
		{placementConstraintUDPFlows, current.UdpFlows, profile.UdpFlows},
	}
	reasons := make([]string, 0, len(permits))
	for _, permit := range permits {
		if exceedsProcessLimit(permit.current, permit.limit, ratio) {
			reasons = append(reasons, permit.reason)
		}
	}
	return reasons
}

func exceedsProcessLimit(current, limit int32, ratio float64) bool {
	return limit <= 0 || float64(current) > float64(limit)*ratio
}

func validateCapacityProfile(profile apiclient.EdgeCapacityProfileDto) error {
	if profile.Version != edgeCapacityProfileVersion {
		return errors.New("edge control returned an unsupported capacity profile version")
	}
	if profile.BytesPerSecondIn <= 0 || profile.BytesPerSecondOut <= 0 ||
		profile.PacketsPerSecond <= 0 || profile.Tunnels <= 0 ||
		profile.HttpRequests <= 0 || profile.HttpConnections <= 0 ||
		profile.HttpStreams <= 0 || profile.TcpConnections <= 0 ||
		profile.UdpFlows <= 0 {
		return errors.New("edge control returned a non-positive capacity profile")
	}
	return nil
}
