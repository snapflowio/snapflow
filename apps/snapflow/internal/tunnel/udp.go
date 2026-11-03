// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/tunnel/plan"
	"github.com/snapflowio/tunnel-go/dispatch"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

const (
	udpFlowIdleTimeout    = 2 * time.Minute
	udpFlowReadInterval   = 15 * time.Second
	maximumUDPFlows       = 8_192
	udpDispatchStripes    = 16
	udpDispatchQueueDepth = 64
	udpDispatchByteLimit  = 16 << 20
	udpMaintenancePeriod  = 5 * time.Second
)

type udpFlowKey struct {
	backendID            uuid.UUID
	assignmentGeneration uint32
	flowID               uint64
}

type udpFlow struct {
	key       udpFlowKey
	conn      net.Conn
	lastSeen  atomic.Int64
	closeOnce sync.Once
}

type udpFlowSet struct {
	tunnel      *edgeTunnel
	session     *transport.Session
	reassembler *protocol.Reassembler
	dispatcher  *dispatch.DatagramDispatcher
	mu          sync.Mutex
	flows       map[udpFlowKey]*udpFlow
	readers     sync.WaitGroup
	closeOnce   sync.Once
}

func newUDPFlowSet(
	ctx context.Context,
	tunnel *edgeTunnel,
	session *transport.Session,
) (*udpFlowSet, error) {
	if tunnel == nil || session == nil {
		return nil, errors.New("machine UDP tunnel and session are required")
	}
	reassembler, err := protocol.NewReassembler(protocol.DefaultReassemblerConfig())
	if err != nil {
		return nil, fmt.Errorf("initialize machine UDP reassembler: %w", err)
	}
	flows := &udpFlowSet{
		tunnel:      tunnel,
		session:     session,
		reassembler: reassembler,
		flows:       make(map[udpFlowKey]*udpFlow),
	}
	dispatcher, err := dispatch.NewDatagramDispatcher(
		ctx,
		dispatch.DatagramDispatcherConfig{
			Stripes:        udpDispatchStripes,
			QueueDepth:     udpDispatchQueueDepth,
			MaxQueuedBytes: udpDispatchByteLimit,
		},
		func(handlerContext context.Context, datagram dispatch.Datagram) error {
			return flows.forward(
				handlerContext,
				datagram.BackendID,
				datagram.AssignmentGeneration,
				datagram.FlowID,
				datagram.Payload,
			)
		},
		func(datagram dispatch.Datagram, err error) {
			tunnel.manager.log.Debug(
				"Machine tunnel UDP datagram was not forwarded",
				"backend_id", datagram.BackendID,
				"error", err,
			)
		},
	)
	if err != nil {
		return nil, fmt.Errorf("initialize machine UDP dispatcher: %w", err)
	}
	flows.dispatcher = dispatcher
	go flows.maintain(ctx)
	return flows, nil
}

func (flows *udpFlowSet) receive(ctx context.Context) error {
	for {
		fragment, err := flows.session.ReceiveUDP(ctx)
		if err != nil {
			return err
		}
		if fragment.Direction != protocol.DatagramToMachine {
			continue
		}
		payload, complete, err := flows.reassembler.Add(fragment, time.Now())
		if err != nil || !complete {
			continue
		}
		flows.dispatcher.Dispatch(dispatch.Datagram{
			BackendID:            fragment.BackendID,
			AssignmentGeneration: fragment.AssignmentGeneration,
			FlowID:               fragment.FlowID,
			Payload:              payload,
		})
	}
}

func (flows *udpFlowSet) forward(
	ctx context.Context,
	backendID uuid.UUID,
	assignmentGeneration uint32,
	flowID uint64,
	payload []byte,
) error {
	target, exists := flows.tunnel.manager.target(
		flows.tunnel.binding.Identity,
		backendID,
		assignmentGeneration,
	)
	if !exists || target.Protocol != protocol.ProtocolUDP {
		return errors.New("requested UDP backend is not assigned to this tunnel")
	}
	key := udpFlowKey{
		backendID:            backendID,
		assignmentGeneration: assignmentGeneration,
		flowID:               flowID,
	}
	flow, err := flows.flow(ctx, key, target)
	if err != nil {
		return err
	}
	flow.lastSeen.Store(time.Now().UnixNano())
	written, err := flow.conn.Write(payload)
	if err != nil {
		return err
	}
	if written != len(payload) {
		return io.ErrShortWrite
	}
	return nil
}

func (flows *udpFlowSet) flow(
	ctx context.Context,
	key udpFlowKey,
	target plan.Target,
) (*udpFlow, error) {
	flows.mu.Lock()
	defer flows.mu.Unlock()
	if existing := flows.flows[key]; existing != nil {
		return existing, nil
	}
	if len(flows.flows) >= maximumUDPFlows {
		return nil, errors.New("machine UDP flow capacity reached")
	}
	connection, err := flows.tunnel.manager.runtime.DialRuntimePort(
		ctx,
		target.SandboxID,
		microvmtypes.RuntimePortTarget{
			Protocol: microvmtypes.RuntimePortUDP,
			Port:     target.Port,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("dial runtime UDP target: %w", err)
	}
	flow := &udpFlow{key: key, conn: connection}
	flow.lastSeen.Store(time.Now().UnixNano())
	flows.flows[key] = flow
	flows.readers.Add(1)
	go flows.readResponses(flow)
	return flow, nil
}

func (flows *udpFlowSet) readResponses(flow *udpFlow) {
	defer flows.readers.Done()
	defer flows.remove(flow)
	buffer := make([]byte, protocol.MaxUDPMessageBytes)
	for {
		if err := flow.conn.SetReadDeadline(time.Now().Add(udpFlowReadInterval)); err != nil {
			return
		}
		read, err := flow.conn.Read(buffer)
		if err != nil {
			var timeout net.Error
			if errors.As(err, &timeout) && timeout.Timeout() {
				continue
			}
			return
		}
		if _, exists := flows.tunnel.manager.target(
			flows.tunnel.binding.Identity,
			flow.key.backendID,
			flow.key.assignmentGeneration,
		); !exists {
			return
		}
		if err := flows.session.SendUDP(
			protocol.DatagramToEdge,
			flow.key.backendID,
			flow.key.assignmentGeneration,
			flow.key.flowID,
			buffer[:read],
		); err != nil {
			return
		}
	}
}

func (flows *udpFlowSet) maintain(ctx context.Context) {
	ticker := time.NewTicker(udpMaintenancePeriod)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			flows.prune(now)
		}
	}
}

func (flows *udpFlowSet) prune(now time.Time) {
	flows.mu.Lock()
	expired := make([]*udpFlow, 0)
	for key, flow := range flows.flows {
		if now.Sub(time.Unix(0, flow.lastSeen.Load())) >= udpFlowIdleTimeout {
			delete(flows.flows, key)
			expired = append(expired, flow)
		}
	}
	flows.mu.Unlock()
	for _, flow := range expired {
		flow.close()
	}
}

func (flows *udpFlowSet) remove(flow *udpFlow) {
	flows.mu.Lock()
	if flows.flows[flow.key] == flow {
		delete(flows.flows, flow.key)
	}
	flows.mu.Unlock()
	flow.close()
}

func (flows *udpFlowSet) close() {
	flows.closeOnce.Do(func() {
		flows.dispatcher.Close()
		flows.mu.Lock()
		active := make([]*udpFlow, 0, len(flows.flows))
		for _, flow := range flows.flows {
			active = append(active, flow)
		}
		flows.flows = make(map[udpFlowKey]*udpFlow)
		flows.mu.Unlock()
		for _, flow := range active {
			flow.close()
		}
		flows.readers.Wait()
	})
}

func (flow *udpFlow) close() {
	flow.closeOnce.Do(func() {
		closeNetworkResource("Machine UDP flow", flow.conn)
	})
}
