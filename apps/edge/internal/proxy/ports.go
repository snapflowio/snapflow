// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package proxy

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
)

const reconcileInterval = time.Second

type Frontend interface {
	Reconcile(ctx context.Context, snapshot *routes.Snapshot, now time.Time) error
	ListenerStatuses() []Status
	Close()
}

type Ports struct {
	routes    RouteUpdates
	frontends []Frontend
	reported  []Status
	changes   chan struct{}
}

func NewPorts(routes RouteUpdates, frontends ...Frontend) (*Ports, error) {
	if routes == nil || len(frontends) == 0 {
		return nil, errors.New("public listener manager requires routes and at least one protocol")
	}
	return &Ports{routes: routes, frontends: frontends, changes: make(chan struct{}, 1)}, nil
}

func (ports *Ports) Run(ctx context.Context) error {
	ticker := time.NewTicker(reconcileInterval)
	defer ticker.Stop()
	defer ports.close()
	for {
		if err := ports.reconcile(ctx); err != nil {
			return err
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ports.routes.Updates():
		case <-ticker.C:
		}
	}
}

func (ports *Ports) ListenerStatusChanges() <-chan struct{} {
	return ports.changes
}

func (ports *Ports) reconcile(ctx context.Context) error {
	snapshot := ports.routes.Load()
	now := time.Now()
	for _, frontend := range ports.frontends {
		if err := frontend.Reconcile(ctx, snapshot, now); err != nil {
			return err
		}
	}
	ports.signalStatusChange()
	return nil
}

func (ports *Ports) signalStatusChange() {
	statuses := ports.ListenerStatuses()
	if slices.Equal(statuses, ports.reported) {
		return
	}
	ports.reported = statuses
	select {
	case ports.changes <- struct{}{}:
	default:
	}
}

func (ports *Ports) ListenerStatuses() []Status {
	statuses := make(map[uuid.UUID]Status)
	for _, frontend := range ports.frontends {
		for _, status := range frontend.ListenerStatuses() {
			statuses[status.BackendID] = status
		}
	}
	return SortedStatuses(statuses)
}

func (ports *Ports) close() {
	for _, frontend := range ports.frontends {
		frontend.Close()
	}
}
