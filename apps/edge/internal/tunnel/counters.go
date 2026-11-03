// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

type datagramMetrics struct {
	Delivered atomic.Uint64
	Dropped   atomic.Uint64
	Failed    atomic.Uint64
}

type DatagramCounters struct {
	Delivered uint64
	Dropped   uint64
	Failed    uint64
}

type BindingAcknowledgement struct {
	MachineID    uuid.UUID
	ConnectionID uuid.UUID
	Binding      protocol.Binding
}

type TunnelCounters struct {
	ActiveStreams          int64
	QUICSessions           int
	HTTP2Sessions          int
	SmoothedRTT            time.Duration
	BytesSent              uint64
	BytesReceived          uint64
	PacketsSent            uint64
	PacketsReceived        uint64
	PacketsLost            uint64
	BindingFenceRejections uint64
}

func (registry *Registry) SessionCount() int32 {
	return registry.sessionNum.Load()
}

func (registry *Registry) SessionHeadroom() int32 {
	return max(
		int32(maxSteadyTunnelSessions)-registry.sessionNum.Load(),
		0,
	)
}

func (registry *Registry) BindingAcknowledgements() []BindingAcknowledgement {
	now := time.Now()
	snapshot := registry.routes.Load()
	registry.mu.RLock()
	defer registry.mu.RUnlock()
	acknowledgements := make([]BindingAcknowledgement, 0, len(registry.sessions))
	for machineID, pool := range registry.sessions {
		for _, session := range pool.candidates() {
			if session == nil || !session.acknowledged.Load() ||
				!snapshot.HasBinding(
					machineID,
					session.machineSessionGeneration,
					session.binding,
					now,
				) {
				continue
			}
			acknowledgements = append(acknowledgements, BindingAcknowledgement{
				MachineID:    machineID,
				ConnectionID: session.sessionID,
				Binding:      session.binding,
			})
			break
		}
	}
	return acknowledgements
}

func (registry *Registry) DatagramCounters() DatagramCounters {
	return DatagramCounters{
		Delivered: registry.datagrams.Delivered.Load(),
		Dropped:   registry.datagrams.Dropped.Load(),
		Failed:    registry.datagrams.Failed.Load(),
	}
}

func (registry *Registry) TunnelCounters() TunnelCounters {
	registry.mu.RLock()
	defer registry.mu.RUnlock()
	result := TunnelCounters{
		BindingFenceRejections: registry.bindingFenceRejections.Load(),
	}
	for _, pool := range registry.sessions {
		for _, session := range pool.candidates() {
			if session != nil {
				result.add(session)
			}
		}
	}
	return result
}

func (counters *TunnelCounters) add(session *machineSession) {
	counters.ActiveStreams += int64(session.activeStreams.Load())
	switch session.transport.TransportName() {
	case transport.TransportNameQUIC:
		counters.QUICSessions++
	case transport.TransportNameHTTP2:
		counters.HTTP2Sessions++
	}
	metrics := session.transport.Metrics()
	counters.SmoothedRTT = max(counters.SmoothedRTT, metrics.SmoothedRTT)
	counters.BytesSent += metrics.BytesSent
	counters.BytesReceived += metrics.BytesReceived
	counters.PacketsSent += metrics.PacketsSent
	counters.PacketsReceived += metrics.PacketsReceived
	counters.PacketsLost += metrics.PacketsLost
}
