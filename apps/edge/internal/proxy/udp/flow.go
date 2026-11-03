// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package udp

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"net"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/admit"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/traffic"
)

const (
	initialAmplificationAllowance = 1_200
	amplificationResponseRatio    = 3
	flowIDAllocationAttempts      = 16
	flowIDBytes                   = 8
	removedRouteIdleTimeout       = time.Second
)

var errFlowIDCollision = errors.New("machine UDP flow identifier collision")

type flowKey struct {
	backendID uuid.UUID
	flowID    uint64
}

type peerFlow struct {
	key           flowKey
	machineID     uuid.UUID
	peer          net.UDPAddr
	worker        *socketWorker
	lastClientAt  atomic.Int64
	requestBytes  atomic.Uint64
	responseBytes atomic.Uint64
	permit        *admit.Permit
	usage         *traffic.Counter
}

func (frontend *Frontend) HandleMachineDatagram(
	ctx context.Context,
	machineID uuid.UUID,
	backendID uuid.UUID,
	flowID uint64,
	payload []byte,
) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	frontend.mu.RLock()
	active := frontend.flows[flowKey{backendID: backendID, flowID: flowID}]
	frontend.mu.RUnlock()
	if active == nil || active.machineID != machineID {
		return errors.New("machine UDP response flow is not active")
	}
	if !active.reserveResponse(len(payload)) {
		return errors.New("machine UDP response exceeded anti-amplification budget")
	}
	if err := active.worker.enqueueResponse(ctx, payload, active.peer); err != nil {
		active.releaseResponse(len(payload))
		return err
	}
	active.usage.AddEgress(uint64(len(payload)), packetsPerDatagram)
	return nil
}

func (frontend *Frontend) registerFlow(candidate *peerFlow) error {
	frontend.mu.Lock()
	defer frontend.mu.Unlock()
	if frontend.closed {
		return ErrClosed
	}
	if _, exists := frontend.flows[candidate.key]; exists {
		return errFlowIDCollision
	}
	frontend.flows[candidate.key] = candidate
	frontend.flowCount.Add(1)
	return nil
}

func (frontend *Frontend) removeFlow(removed *peerFlow) {
	frontend.mu.Lock()
	defer frontend.mu.Unlock()
	if frontend.flows[removed.key] != removed {
		return
	}
	delete(frontend.flows, removed.key)
	frontend.flowCount.Add(-1)
	removed.worker.group.releaseFlow()
	removed.permit.Release()
	removed.usage.Close()
}

func (worker *socketWorker) newFlow(
	route routes.UDP,
	peer *net.UDPAddr,
	permit *admit.Permit,
	usage *traffic.Counter,
) (*peerFlow, error) {
	for range flowIDAllocationAttempts {
		flowID, err := randomFlowID()
		if err != nil {
			return nil, err
		}
		candidate := &peerFlow{
			key:       flowKey{backendID: route.BackendID, flowID: flowID},
			machineID: route.MachineID,
			peer:      *peer,
			worker:    worker,
			permit:    permit,
			usage:     usage,
		}
		candidate.lastClientAt.Store(time.Now().UnixNano())
		err = worker.parent.registerFlow(candidate)
		if errors.Is(err, errFlowIDCollision) {
			continue
		}
		if err != nil {
			return nil, err
		}
		return candidate, nil
	}
	return nil, errors.New("could not allocate a unique UDP flow identifier")
}

func (worker *socketWorker) pruneIdleFlows(now time.Time) {
	route, exists := worker.parent.routes.Load().UDPExisting(worker.port, now)
	idleTimeout := removedRouteIdleTimeout
	if exists {
		idleTimeout = route.Policy.IdleTimeout
	}
	worker.mu.Lock()
	var removed []*peerFlow
	for key, idle := range worker.flows {
		if !exists || now.Sub(time.Unix(0, idle.lastClientAt.Load())) >= idleTimeout {
			delete(worker.flows, key)
			removed = append(removed, idle)
		}
	}
	worker.mu.Unlock()
	for _, idle := range removed {
		worker.parent.removeFlow(idle)
	}
}

func (flow *peerFlow) reserveResponse(size int) bool {
	if size < 0 {
		return false
	}
	responseSize := uint64(size)
	for {
		current := flow.responseBytes.Load()
		maximum := uint64(initialAmplificationAllowance) +
			flow.requestBytes.Load()*amplificationResponseRatio
		if responseSize > maximum || current > maximum-responseSize {
			return false
		}
		if flow.responseBytes.CompareAndSwap(current, current+responseSize) {
			return true
		}
	}
}

func (flow *peerFlow) releaseResponse(size int) {
	flow.responseBytes.Add(^uint64(size - 1))
}

func randomFlowID() (uint64, error) {
	for {
		var encoded [flowIDBytes]byte
		if _, err := rand.Read(encoded[:]); err != nil {
			return 0, fmt.Errorf("generate UDP flow identifier: %w", err)
		}
		if value := binary.BigEndian.Uint64(encoded[:]); value != 0 {
			return value, nil
		}
	}
}
