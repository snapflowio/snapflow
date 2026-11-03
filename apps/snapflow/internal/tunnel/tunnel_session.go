// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

type tunnelSession struct {
	tunnel              *edgeTunnel
	carrier             *transport.Session
	renewAt             time.Time
	cancel              context.CancelFunc
	flows               *udpFlowSet
	slots               chan struct{}
	heartbeatConfirmed  chan struct{}
	controlAcknowledged chan struct{}
	acknowledgeOnce     sync.Once
	failedSignal        chan struct{}
	failOnce            sync.Once
	failureErr          error
	admissionMu         sync.Mutex
	draining            atomic.Bool
	workers             sync.WaitGroup
	streams             sync.WaitGroup
	closeOnce           sync.Once
}

func startTunnelSession(
	tunnel *edgeTunnel,
	carrier *transport.Session,
	controlStream transport.Stream,
	maximumStreams int,
	renewAt time.Time,
) (*tunnelSession, error) {
	ctx, cancel := context.WithCancel(carrier.Context())
	flows, err := newUDPFlowSet(ctx, tunnel, carrier)
	if err != nil {
		cancel()
		closeTunnelCarrier(tunnel, carrier, "Machine tunnel UDP setup failed")
		return nil, err
	}
	session := &tunnelSession{
		tunnel:              tunnel,
		carrier:             carrier,
		renewAt:             renewAt,
		cancel:              cancel,
		flows:               flows,
		slots:               make(chan struct{}, maximumStreams),
		heartbeatConfirmed:  make(chan struct{}),
		controlAcknowledged: make(chan struct{}),
		failedSignal:        make(chan struct{}),
	}
	session.workers.Go(func() { session.fail(session.respondToHeartbeats(ctx, controlStream)) })
	session.workers.Go(func() { session.fail(session.acceptStreams(ctx)) })
	session.workers.Go(func() { session.fail(flows.receive(ctx)) })
	return session, nil
}

func (session *tunnelSession) renewalDue() time.Time { return session.renewAt }

func (session *tunnelSession) confirmControlAcknowledgement() {
	session.acknowledgeOnce.Do(func() { close(session.controlAcknowledged) })
}

func (session *tunnelSession) failed() <-chan struct{} { return session.failedSignal }

func (session *tunnelSession) failure() error { return session.failureErr }

func (session *tunnelSession) fail(err error) {
	session.failOnce.Do(func() {
		session.failureErr = err
		close(session.failedSignal)
	})
}

func (session *tunnelSession) drain(ctx context.Context, timeout time.Duration) {
	session.admissionMu.Lock()
	session.draining.Store(true)
	session.admissionMu.Unlock()
	idle := make(chan struct{})
	go func() {
		session.streams.Wait()
		close(idle)
	}()
	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	select {
	case <-idle:
	case <-deadline.C:
	case <-session.failedSignal:
	case <-ctx.Done():
	}
	session.close()
}

func (session *tunnelSession) close() {
	session.closeOnce.Do(func() {
		session.cancel()
		closeTunnelCarrier(session.tunnel, session.carrier, "Machine tunnel session closed")
		session.flows.close()
		session.workers.Wait()
		session.streams.Wait()
	})
}

func (session *tunnelSession) beginStream() bool {
	session.admissionMu.Lock()
	defer session.admissionMu.Unlock()
	if session.draining.Load() {
		return false
	}
	session.streams.Add(1)
	return true
}

func (session *tunnelSession) respondToHeartbeats(
	ctx context.Context,
	stream transport.Stream,
) error {
	request, err := readHeartbeat(stream)
	if err != nil {
		return err
	}
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-session.controlAcknowledged:
	}
	if err := session.answerHeartbeat(stream, request); err != nil {
		return err
	}
	close(session.heartbeatConfirmed)
	for ctx.Err() == nil {
		request, err := readHeartbeat(stream)
		if err != nil {
			return err
		}
		if err := session.answerHeartbeat(stream, request); err != nil {
			return err
		}
	}
	return ctx.Err()
}

func readHeartbeat(stream transport.Stream) (protocol.HeartbeatRequest, error) {
	if err := stream.SetReadDeadline(time.Now().Add(tunnelHeartbeatTimeout)); err != nil {
		return protocol.HeartbeatRequest{}, fmt.Errorf("set tunnel heartbeat deadline: %w", err)
	}
	var request protocol.HeartbeatRequest
	if err := protocol.ReadFrame(stream, &request); err != nil {
		return protocol.HeartbeatRequest{}, fmt.Errorf("read tunnel heartbeat: %w", err)
	}
	if err := request.Validate(); err != nil {
		return protocol.HeartbeatRequest{}, fmt.Errorf("validate tunnel heartbeat: %w", err)
	}
	return request, nil
}

func (session *tunnelSession) answerHeartbeat(stream transport.Stream, request protocol.HeartbeatRequest) error {
	if err := protocol.WriteFrameLimit(
		stream,
		protocol.HeartbeatResponse{
			Version:  protocol.Version,
			Sequence: request.Sequence,
			Binding:  session.tunnel.binding.Identity,
			Draining: session.draining.Load(),
		},
		protocol.MaxHeartbeatFrameBytes,
	); err != nil {
		return fmt.Errorf("write tunnel heartbeat: %w", err)
	}
	if err := stream.SetDeadline(time.Time{}); err != nil {
		return fmt.Errorf("clear tunnel heartbeat deadline: %w", err)
	}
	return nil
}

func closeTunnelCarrier(tunnel *edgeTunnel, carrier *transport.Session, reason string) {
	if err := carrier.Close(0, reason); err != nil {
		tunnel.manager.log.Debug("Machine tunnel carrier did not close cleanly", "reason", reason, "error", err)
	}
}
