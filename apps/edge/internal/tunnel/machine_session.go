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
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

const (
	replacedSessionCloseCode   = 3
	replacedSessionCloseReason = "replaced by a newer Machine session"
)

type machineSession struct {
	machineID                uuid.UUID
	machineSessionGeneration uint32
	sessionID                uuid.UUID
	transport                *transport.Session
	cancel                   context.CancelFunc
	binding                  protocol.Binding
	acknowledged             atomic.Bool
	activeStreams            atomic.Int32
	draining                 atomic.Bool
}

type sessionPool struct {
	stable      *machineSession
	replacement *machineSession
}

func (pool *sessionPool) candidates() [maxSessionsPerBinding]*machineSession {
	if pool == nil {
		return [maxSessionsPerBinding]*machineSession{}
	}
	return [maxSessionsPerBinding]*machineSession{
		pool.replacement,
		pool.stable,
	}
}

func (registry *Registry) sessionFor(
	route routes.Base,
	now time.Time,
) (*machineSession, error) {
	if !route.AcceptsNew(now) || registry.draining.Load() {
		return nil, ErrMachineUnavailable
	}
	registry.mu.RLock()
	selected := registry.sessionForLocked(route)
	registry.mu.RUnlock()
	if selected == nil {
		return nil, ErrMachineUnavailable
	}
	return selected, nil
}

func (registry *Registry) sessionForLocked(
	route routes.Base,
) *machineSession {
	pool := registry.sessions[route.MachineID]
	if pool == nil {
		return nil
	}
	snapshot := registry.routes.Load()
	now := time.Now()
	var selected *machineSession
	for _, candidate := range pool.candidates() {
		if candidate == nil || !candidate.acknowledged.Load() || candidate.draining.Load() ||
			!snapshot.HasBinding(
				route.MachineID,
				candidate.machineSessionGeneration,
				candidate.binding,
				now,
			) {
			continue
		}
		if selected == nil ||
			candidate.activeStreams.Load() < selected.activeStreams.Load() {
			selected = candidate
		}
	}
	return selected
}

func (registry *Registry) install(session *machineSession) error {
	registry.mu.Lock()
	pool := registry.sessions[session.machineID]
	if pool == nil {
		pool = &sessionPool{}
		registry.sessions[session.machineID] = pool
	}
	sessionCount := registry.sessionNum.Load()
	steadyCapacityReached := pool.stable == nil &&
		sessionCount >= maxSteadyTunnelSessions
	replacementCapacityReached := pool.stable != nil &&
		pool.replacement == nil &&
		sessionCount >= maxTunnelSessions
	if steadyCapacityReached || replacementCapacityReached {
		if pool.stable == nil && pool.replacement == nil {
			delete(registry.sessions, session.machineID)
		}
		registry.mu.Unlock()
		return errors.New("edge tunnel session capacity reached")
	}
	var replaced *machineSession
	switch {
	case pool.stable == nil:
		pool.stable = session
		registry.sessionNum.Add(1)
	case pool.replacement == nil:
		pool.replacement = session
		registry.sessionNum.Add(1)
	default:
		replaced = pool.replacement
		pool.replacement = session
	}
	registry.mu.Unlock()
	if replaced != nil {
		registry.closeReplacedSession(replaced)
	}
	return nil
}

func (registry *Registry) closeReplacedSession(replaced *machineSession) {
	replaced.cancel()
	if replaced.transport == nil {
		return
	}
	if err := replaced.transport.Close(
		replacedSessionCloseCode,
		replacedSessionCloseReason,
	); err != nil {
		registry.logger.Debug(
			"replaced Machine tunnel did not close cleanly",
			"machine_id", replaced.machineID,
			"error", err,
		)
	}
}

func (registry *Registry) remove(session *machineSession) {
	registry.mu.Lock()
	pool := registry.sessions[session.machineID]
	removed := false
	if pool != nil {
		switch session {
		case pool.stable:
			pool.stable = pool.replacement
			pool.replacement = nil
			removed = true
		case pool.replacement:
			pool.replacement = nil
			removed = true
		}
		if pool.stable == nil {
			delete(registry.sessions, session.machineID)
		}
	}
	if removed {
		registry.sessionNum.Add(-1)
	}
	registry.mu.Unlock()
	session.cancel()
}
