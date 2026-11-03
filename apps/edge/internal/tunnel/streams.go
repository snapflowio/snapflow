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
	"net/netip"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

func (registry *Registry) OpenStream(
	ctx context.Context,
	route routes.Base,
	routeProtocol protocol.Protocol,
	source netip.AddrPort,
) (transport.Stream, error) {
	for range maxSessionsPerBinding - 1 {
		stream, err := registry.openStreamOnce(ctx, route, routeProtocol, source)
		if !isMachineDraining(err) {
			return stream, err
		}
	}
	return registry.openStreamOnce(ctx, route, routeProtocol, source)
}

func (registry *Registry) openStreamOnce(
	ctx context.Context,
	route routes.Base,
	routeProtocol protocol.Protocol,
	source netip.AddrPort,
) (transport.Stream, error) {
	now := time.Now()
	session, err := registry.sessionFor(route, now)
	if err != nil {
		return nil, err
	}
	if registry.hasNegativeTarget(route, session.binding, now) {
		return nil, ErrMachineUnavailable
	}
	stream, err := session.transport.OpenStream(ctx, protocol.StreamOpen{
		Version:              protocol.Version,
		Binding:              session.binding,
		BackendID:            route.BackendID,
		AssignmentGeneration: route.AssignmentGeneration,
		ConnectionID:         uuid.New(),
		Protocol:             routeProtocol,
		Source:               source,
	})
	if err != nil {
		if isMachineDraining(err) {
			session.draining.Store(true)
		}
		registry.recordTargetRejection(route, session.binding, err, now)
		return nil, err
	}
	registry.clearNegativeTarget(route, session.binding)
	session.activeStreams.Add(1)
	registry.mu.Lock()
	registry.backendStreams[route.BackendID]++
	registry.mu.Unlock()
	return newTrackedStream(
		stream,
		&session.activeStreams,
		func() { registry.releaseBackendStream(route.BackendID) },
	), nil
}

func (registry *Registry) BackendLoad(route routes.Base) (int64, bool) {
	now := time.Now()
	if !route.AcceptsNew(now) || registry.draining.Load() {
		return 0, false
	}
	registry.mu.RLock()
	defer registry.mu.RUnlock()
	session := registry.sessionForLocked(route)
	if session == nil || registry.hasActiveNegativeTargetLocked(route, session.binding, now) {
		return 0, false
	}
	return registry.backendStreams[route.BackendID], true
}

func (registry *Registry) releaseBackendStream(backendID uuid.UUID) {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	active := registry.backendStreams[backendID] - 1
	if active <= 0 {
		delete(registry.backendStreams, backendID)
		return
	}
	registry.backendStreams[backendID] = active
}

func (registry *Registry) SendUDP(
	route routes.Base,
	flowID uint64,
	payload []byte,
) error {
	session, err := registry.sessionFor(route, time.Now())
	if err != nil {
		return err
	}
	return session.transport.SendUDP(
		protocol.DatagramToMachine,
		route.BackendID,
		route.AssignmentGeneration,
		flowID,
		payload,
	)
}

func isMachineDraining(err error) bool {
	var rejected *transport.StreamOpenRejectedError
	return errors.As(err, &rejected) && rejected.Status == protocol.StreamOpenStatusMachineDraining
}
