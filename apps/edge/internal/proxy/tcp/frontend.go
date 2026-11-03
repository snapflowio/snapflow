// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tcp

import (
	"context"
	"errors"
	"log/slog"
	"net/netip"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/admit"
	"github.com/snapflowio/edge/internal/proxy"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/tunnel-go/protocol"
)

type admitter interface {
	AdmitTCP(source netip.Addr, scope admit.Scope) (*admit.Permit, admit.Result)
}

var _ proxy.Frontend = (*Frontend)(nil)

type Frontend struct {
	logger      *slog.Logger
	routes      proxy.Routes
	streams     proxy.Streams
	meter       proxy.Meter
	admission   admitter
	connections atomic.Int32
	listeners   *proxy.Table[routes.TCP, *portListener]
}

func New(
	snapshots proxy.Routes,
	streams proxy.Streams,
	meter proxy.Meter,
	admission admitter,
	opts ...Option,
) (*Frontend, error) {
	if snapshots == nil || streams == nil || meter == nil || admission == nil {
		return nil, errors.New(
			"TCP ingress requires routes, a tunnel, usage metering, and admission",
		)
	}
	frontend := &Frontend{
		logger:    newOptions(opts).logger,
		routes:    snapshots,
		streams:   streams,
		meter:     meter,
		admission: admission,
	}
	listeners, err := proxy.NewTable(proxy.TableSpec[routes.TCP, *portListener]{
		Protocol: protocol.ProtocolTCP,
		Port:     func(route routes.TCP) uint16 { return route.PublicPort },
		Backend:  func(route routes.TCP) uuid.UUID { return route.BackendID },
		Open:     frontend.openListener,
	})
	if err != nil {
		return nil, err
	}
	frontend.listeners = listeners
	return frontend, nil
}

func (frontend *Frontend) ConnectionCount() int32 {
	return frontend.connections.Load()
}

func (frontend *Frontend) ListenerStatuses() []proxy.Status {
	return frontend.listeners.Statuses()
}

func (frontend *Frontend) Reconcile(
	ctx context.Context,
	snapshot *routes.Snapshot,
	now time.Time,
) error {
	if snapshot == nil {
		return errors.New("machine TCP ingress route snapshot is required")
	}
	return frontend.listeners.Reconcile(ctx, snapshot.TCPRoutes(now))
}

func (frontend *Frontend) Close() {
	frontend.listeners.Close()
}
