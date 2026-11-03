// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"errors"
	"fmt"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/protocol"
)

const (
	maximumTCPConnectionLimit  = 1_000_000
	maximumUDPFlowLimit        = 1_000_000
	maximumUDPPacketsPerSecond = 1_000_000
	maximumUDPDatagramPayload  = 32 * 1024
)

func parseTCPRoute(input *apiclient.EdgeTcpRouteDto) (TCP, error) {
	base, err := parseBase(tcpRouteInput(input))
	if err != nil {
		return TCP{}, err
	}
	if string(input.Protocol) != string(protocol.ProtocolTCP) {
		return TCP{}, fmt.Errorf("invalid TCP route protocol %q", input.Protocol)
	}
	publicPort, err := parsePort(input.PublicPort)
	if err != nil {
		return TCP{}, fmt.Errorf("machine TCP public port: %w", err)
	}
	proxyMode, err := parseProxyProtocol(input.Policy.ProxyProtocol)
	if err != nil {
		return TCP{}, err
	}
	if err := validateSeconds(input.Policy.IdleTimeoutSeconds, false); err != nil {
		return TCP{}, fmt.Errorf("machine TCP idle timeout: %w", err)
	}
	if input.Policy.ConnectionLimit < 1 ||
		input.Policy.ConnectionLimit > maximumTCPConnectionLimit {
		return TCP{}, errors.New("machine TCP connection limit is invalid")
	}
	return TCP{
		Base:       base,
		PublicPort: publicPort,
		Policy: TCPPolicy{
			ProxyProtocol:   proxyMode,
			IdleTimeout:     seconds(input.Policy.IdleTimeoutSeconds),
			ConnectionLimit: input.Policy.ConnectionLimit,
		},
	}, nil
}

func parseUDPRoute(input *apiclient.EdgeUdpRouteDto) (UDP, error) {
	base, err := parseBase(udpRouteInput(input))
	if err != nil {
		return UDP{}, err
	}
	if string(input.Protocol) != string(protocol.ProtocolUDP) {
		return UDP{}, fmt.Errorf("invalid UDP route protocol %q", input.Protocol)
	}
	publicPort, err := parsePort(input.PublicPort)
	if err != nil {
		return UDP{}, fmt.Errorf("machine UDP public port: %w", err)
	}
	policy := input.Policy
	if err := validateSeconds(policy.IdleTimeoutSeconds, false); err != nil {
		return UDP{}, fmt.Errorf("machine UDP idle timeout: %w", err)
	}
	if policy.FlowLimit < 1 || policy.FlowLimit > maximumUDPFlowLimit {
		return UDP{}, errors.New("machine UDP flow limit is invalid")
	}
	if policy.PacketsPerSecond < 1 || policy.PacketsPerSecond > maximumUDPPacketsPerSecond {
		return UDP{}, errors.New("machine UDP packet rate is invalid")
	}
	if policy.MaximumDatagramPayloadBytes < 1 ||
		policy.MaximumDatagramPayloadBytes > maximumUDPDatagramPayload {
		return UDP{}, errors.New("UDP maximum datagram payload is invalid")
	}
	return UDP{
		Base:       base,
		PublicPort: publicPort,
		Policy: UDPPolicy{
			IdleTimeout:             seconds(policy.IdleTimeoutSeconds),
			FlowLimit:               policy.FlowLimit,
			PacketsPerSecond:        policy.PacketsPerSecond,
			MaxDatagramPayloadBytes: policy.MaximumDatagramPayloadBytes,
		},
	}, nil
}
