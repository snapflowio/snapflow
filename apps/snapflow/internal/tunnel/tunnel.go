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
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/snapflow/internal/tunnel/plan"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/reconnect"
	"github.com/snapflowio/tunnel-go/transport"
)

const (
	tunnelHeartbeatTimeout = 30 * time.Second
	certificateRenewalLead = 30 * time.Second
	initialConnectionGrace = 30 * time.Second
	sessionDrainTimeout    = 2 * time.Minute
)

type edgeTunnel struct {
	manager   *Manager
	binding   plan.Binding
	dialer    *transport.Dialer
	cancel    context.CancelFunc
	done      chan struct{}
	ready     chan struct{}
	readyOnce sync.Once
}

func newEdgeTunnel(parent context.Context, manager *Manager, binding plan.Binding) *edgeTunnel {
	ctx, cancel := context.WithCancel(parent)
	tunnel := &edgeTunnel{
		manager: manager,
		binding: binding,
		dialer:  transport.NewDialer(),
		cancel:  cancel,
		done:    make(chan struct{}),
		ready:   make(chan struct{}),
	}
	go tunnel.run(ctx)
	return tunnel
}

func (tunnel *edgeTunnel) close() {
	tunnel.cancel()
	<-tunnel.done
}

func (tunnel *edgeTunnel) waitReady(ctx context.Context) bool {
	select {
	case <-ctx.Done():
		return false
	case <-tunnel.ready:
		return true
	}
}

func (tunnel *edgeTunnel) run(ctx context.Context) {
	defer close(tunnel.done)
	supervisor := sessionSupervisor{
		establish: func(establishContext context.Context) (servingSession, error) {
			return tunnel.establish(establishContext)
		},
		ready: func() { tunnel.readyOnce.Do(func() { close(tunnel.ready) }) },
		log: tunnel.manager.log.With(
			slog.String("edge_id", tunnel.binding.EdgeID.String()),
			slog.String("binding_id", tunnel.binding.Identity.ID.String()),
		),
		backoff:      reconnect.DefaultBackoff(),
		drainTimeout: sessionDrainTimeout,
	}
	supervisor.run(ctx)
}

func (tunnel *edgeTunnel) establish(ctx context.Context) (*tunnelSession, error) {
	certificateContext, cancelCertificate := context.WithTimeout(ctx, tunnelControlTimeout)
	tlsConfig, certificateExpiry, err := tunnel.manager.issuer.TLSConfig(
		certificateContext,
		tunnel.binding,
	)
	cancelCertificate()
	if err != nil {
		return nil, err
	}
	sessionConfig := transport.DefaultClientConfig()
	carrier, err := tunnel.dialer.Dial(ctx, tunnel.binding.Address, tlsConfig, sessionConfig)
	if err != nil {
		return nil, err
	}
	connectionID := uuid.New()
	controlStream, serverHello, err := carrier.ClientHandshake(ctx, protocol.ClientHello{
		Version:                  protocol.Version,
		MachineID:                tunnel.manager.machineID,
		MachineSessionGeneration: tunnel.manager.credentials.Generation,
		SessionID:                connectionID,
		Binding:                  tunnel.binding.Identity,
	})
	if err != nil {
		return nil, errors.Join(err, carrier.Close(0, "Machine tunnel handshake failed"))
	}
	if serverHello.EdgeID != tunnel.binding.EdgeID.String() {
		return nil, errors.Join(
			fmt.Errorf("connected Edge identified itself as %s", serverHello.EdgeID),
			carrier.Close(0, "Machine tunnel reached the wrong Edge"),
		)
	}
	session, err := startTunnelSession( //nolint:contextcheck // the session lives as long as the carrier and derives from carrier.Context
		tunnel,
		carrier,
		controlStream,
		int(sessionConfig.MaxIncomingStreams),
		certificateExpiry.Add(-certificateRenewalLead),
	)
	if err != nil {
		return nil, err
	}
	acknowledgementContext, cancelAcknowledgement := context.WithTimeout(ctx, tunnelControlTimeout)
	err = tunnel.manager.control.AcknowledgeBinding(
		acknowledgementContext,
		tunnel.binding,
		connectionID,
		carrier,
	)
	cancelAcknowledgement()
	if err != nil {
		session.close()
		return nil, err
	}
	session.confirmControlAcknowledgement()
	select {
	case <-ctx.Done():
		session.close()
		return nil, ctx.Err()
	case <-session.failed():
		session.close()
		return nil, session.failure()
	case <-session.heartbeatConfirmed:
		return session, nil
	}
}
