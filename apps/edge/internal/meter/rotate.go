// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	tunnelprotocol "github.com/snapflowio/tunnel-go/protocol"
)

type sessionWindow struct {
	generation int32
	issuedAt   time.Time
	expiresAt  time.Time
}

func (meter *Meter) rotate(endedAt time.Time) error {
	meter.mu.Lock()
	defer meter.mu.Unlock()
	meter.harvest()
	current := currentSessionWindow(meter.session)
	if current.generation == meter.window.generation {
		meter.window.expiresAt = current.expiresAt
	}
	end := earliest(canonicalTime(endedAt), canonicalTime(meter.window.expiresAt))
	samples := meter.samples()
	switch {
	case len(samples) == 0:
		meter.intervalStart = latest(meter.intervalStart, end)
	case end.After(meter.intervalStart):
		if err := meter.intervals.enqueue(usageInterval{
			EdgeSessionGeneration: meter.window.generation,
			IntervalStartedAt:     latest(meter.intervalStart, end.Add(-maximumInterval)),
			IntervalEndedAt:       end,
			Samples:               samples,
		}); err != nil {
			return err
		}
		meter.counters = make(map[uuid.UUID]backendCounters)
		meter.intervalStart = end
	}
	if current.generation != meter.window.generation {
		meter.window = current
		meter.intervalStart = latest(meter.intervalStart, canonicalTime(current.issuedAt))
	}
	if meter.intervalDrops > 0 {
		meter.logger.Warn(
			"dropped Edge usage that could not be attributed to a metered backend",
			"records", meter.intervalDrops,
		)
		meter.intervalDrops = 0
	}
	return nil
}

func (meter *Meter) samples() []apiclient.EdgeUsageSampleDto {
	samples := make([]apiclient.EdgeUsageSampleDto, 0, len(meter.counters))
	for backendID, counters := range meter.counters {
		if counters.empty() {
			continue
		}
		samples = append(samples, apiclient.EdgeUsageSampleDto{
			BackendId:            backendID,
			AssignmentGeneration: counters.assignmentGeneration,
			Protocol:             counters.protocol,
			BytesIn:              strconv.FormatUint(counters.bytesIn, 10),
			BytesOut:             strconv.FormatUint(counters.bytesOut, 10),
			PacketsIn:            strconv.FormatUint(counters.packetsIn, 10),
			PacketsOut:           strconv.FormatUint(counters.packetsOut, 10),
			TcpConnections:       clampInt32(counters.tcpConnections),
			UdpFlows:             clampInt32(counters.udpFlows),
		})
	}
	slices.SortFunc(samples, func(left, right apiclient.EdgeUsageSampleDto) int {
		return strings.Compare(left.BackendId.String(), right.BackendId.String())
	})
	return samples
}

func currentSessionWindow(session SessionSource) sessionWindow {
	credentials := session.Credentials()
	return sessionWindow{
		generation: credentials.Generation,
		issuedAt:   credentials.IssuedAt,
		expiresAt:  session.Expiry(),
	}
}

func earliest(left, right time.Time) time.Time {
	if right.Before(left) {
		return right
	}
	return left
}

func latest(left, right time.Time) time.Time {
	if right.After(left) {
		return right
	}
	return left
}

func usageNetworkProtocol(value tunnelprotocol.Protocol) (apiclient.NetworkProtocol, error) {
	switch value {
	case tunnelprotocol.ProtocolHTTP:
		return apiclient.NetworkProtocolHttp, nil
	case tunnelprotocol.ProtocolTCP:
		return apiclient.NetworkProtocolTcp, nil
	case tunnelprotocol.ProtocolUDP:
		return apiclient.NetworkProtocolUdp, nil
	default:
		return "", fmt.Errorf("unsupported usage network protocol %q", value)
	}
}

func clampInt32(value uint64) int32 {
	if value > math.MaxInt32 {
		return math.MaxInt32
	}
	return int32(value)
}
