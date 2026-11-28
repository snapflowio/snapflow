// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package udp

import (
	"context"
	"errors"
	"log/slog"
	"net/netip"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/admit"
	"github.com/snapflowio/edge/internal/proxy"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/sockets"
	"github.com/snapflowio/tunnel-go/protocol"
)

var (
	ErrClosed            = errors.New("machine UDP proxy is closed")
	ErrSenderUnavailable = errors.New("machine UDP sender is unavailable")
)

type Sender interface {
	SendUDP(route routes.Base, flowID uint64, payload []byte) error
}

type admitter interface {
	AllowUDP(source netip.Addr, newFlow bool) admit.Result
	AdmitUDPFlow(source netip.Addr, scope admit.Scope) (*admit.Permit, admit.Result)
}

var _ proxy.Frontend = (*Frontend)(nil)

type Frontend struct {
	logger                  *slog.Logger
	routes                  proxy.Routes
	meter                   proxy.Meter
	admission               admitter
	listeners               *proxy.Table[routes.UDP, *listenerGroup]
	sockets                 *sockets.Metrics
	mu                      sync.RWMutex
	sender                  Sender
	flows                   map[flowKey]*peerFlow
	closed                  bool
	flowCount               atomic.Int32
	queuedResponseBytes     atomic.Int64
	responseQueueRejections atomic.Uint64
}

func New(
	snapshots proxy.Routes,
	meter proxy.Meter,
	admission admitter,
	opts ...Option,
) (*Frontend, error) {
	if snapshots == nil || meter == nil || admission == nil {
		return nil, errors.New(
			"UDP ingress requires a route store, usage metering, and admission",
		)
	}
	configured := newOptions(opts)
	frontend := &Frontend{
		logger:    configured.logger,
		routes:    snapshots,
		meter:     meter,
		admission: admission,
		sockets:   sockets.NewMetrics(configured.logger),
		flows:     make(map[flowKey]*peerFlow),
	}
	listeners, err := proxy.NewTable(proxy.TableSpec[routes.UDP, *listenerGroup]{
		Protocol: protocol.ProtocolUDP,
		Port:     func(route routes.UDP) uint16 { return route.PublicPort },
		Backend:  func(route routes.UDP) uuid.UUID { return route.BackendID },
		Open:     frontend.openListenerGroup,
	})
	if err != nil {
		return nil, err
	}
	frontend.listeners = listeners
	return frontend, nil
}

func (frontend *Frontend) AttachSender(sender Sender) error {
	if sender == nil {
		return errors.New("machine UDP sender is required")
	}
	frontend.mu.Lock()
	defer frontend.mu.Unlock()
	if frontend.sender != nil {
		return errors.New("machine UDP sender is already attached")
	}
	frontend.sender = sender
	return nil
}

func (frontend *Frontend) Reconcile(
	ctx context.Context,
	snapshot *routes.Snapshot,
	now time.Time,
) error {
	return frontend.listeners.Reconcile(ctx, snapshot.UDPListenerRoutes(now))
}

func (frontend *Frontend) ListenerStatuses() []proxy.Status {
	return frontend.listeners.Statuses()
}

func (frontend *Frontend) Sockets() *sockets.Metrics {
	return frontend.sockets
}

func (frontend *Frontend) FlowCount() int32 {
	return frontend.flowCount.Load()
}

func (frontend *Frontend) QueuedResponseBytes() int64 {
	return frontend.queuedResponseBytes.Load()
}

func (frontend *Frontend) ResponseQueueRejections() uint64 {
	return frontend.responseQueueRejections.Load()
}

func (frontend *Frontend) Close() {
	frontend.mu.Lock()
	frontend.closed = true
	frontend.mu.Unlock()
	frontend.listeners.Close()
}

func (frontend *Frontend) send(route routes.Base, flowID uint64, payload []byte) error {
	frontend.mu.RLock()
	sender := frontend.sender
	frontend.mu.RUnlock()
	if sender == nil {
		return ErrSenderUnavailable
	}
	return sender.SendUDP(route, flowID, payload)
}
