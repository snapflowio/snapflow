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
	"slices"
	"sync"
	"sync/atomic"

	"github.com/google/uuid"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

var (
	ErrOriginUnavailable    = errors.New("no origin tunnel is connected")
	errOriginAuthentication = errors.New("origin tunnel authentication failed")
	errOriginsNotConfigured = errors.New("this edge accepts no origin tunnels")
	errOriginSessionEnded   = errors.New("origin tunnel session ended")
)

type originSession struct {
	site      string
	sessionID uuid.UUID
	transport *transport.Session
}

type originPool struct {
	mu       sync.RWMutex
	sessions []*originSession
	next     atomic.Uint64
}

func (pool *originPool) add(session *originSession) {
	pool.mu.Lock()
	defer pool.mu.Unlock()
	pool.sessions = append(pool.sessions, session)
}

func (pool *originPool) remove(session *originSession) {
	pool.mu.Lock()
	defer pool.mu.Unlock()
	pool.sessions = slices.DeleteFunc(pool.sessions, func(candidate *originSession) bool {
		return candidate == session
	})
}

func (pool *originPool) snapshot() []*originSession {
	pool.mu.RLock()
	defer pool.mu.RUnlock()
	return slices.Clone(pool.sessions)
}

func (pool *originPool) count() int {
	pool.mu.RLock()
	defer pool.mu.RUnlock()
	return len(pool.sessions)
}

func (registry *Registry) OriginSessionCount() int {
	return registry.origins.count()
}

func (registry *Registry) OpenOriginStream(
	ctx context.Context,
	open protocol.OriginStreamOpen,
) (transport.Stream, error) {
	sessions := registry.origins.snapshot()
	if len(sessions) == 0 {
		return nil, ErrOriginUnavailable
	}
	start := registry.origins.next.Add(1)
	var failures []error
	for offset := range len(sessions) {
		candidate := sessions[(start+uint64(offset))%uint64(len(sessions))]
		stream, err := candidate.transport.OpenOriginStream(ctx, open)
		if err == nil {
			return stream, nil
		}
		failures = append(failures, fmt.Errorf("origin session %s: %w", candidate.sessionID, err))
		if ctx.Err() != nil {
			break
		}
	}
	return nil, errors.Join(append([]error{ErrOriginUnavailable}, failures...)...)
}

func (registry *Registry) authenticateOrigin(
	session *transport.Session,
	hello protocol.ClientHello,
) (protocol.ServerHello, error) {
	if registry.config.OriginSite == "" {
		return protocol.ServerHello{}, errOriginsNotConfigured
	}
	certificate, err := session.VerifiedPeerCertificate()
	if err != nil {
		return protocol.ServerHello{}, fmt.Errorf("read origin tunnel certificate: %w", err)
	}
	peer, err := protocol.ParseOriginCertificate(certificate)
	if err != nil || peer.Site != hello.OriginSite || peer.Site != registry.config.OriginSite {
		return protocol.ServerHello{}, errOriginAuthentication
	}
	return registry.serverHello(), nil
}

func (registry *Registry) serveOrigin(
	ctx context.Context,
	session *transport.Session,
	controlStream transport.Stream,
	hello protocol.ClientHello,
) error {
	active := &originSession{site: hello.OriginSite, sessionID: hello.SessionID, transport: session}
	registry.origins.add(active)
	defer registry.origins.remove(active)
	registry.logger.Info("origin tunnel connected", "site", active.site, "session_id", active.sessionID, "transport", session.TransportName())
	defer registry.logger.Info("origin tunnel disconnected", "site", active.site, "session_id", active.sessionID)
	select {
	case <-ctx.Done():
	case <-session.Context().Done():
	}
	return errors.Join(errOriginSessionEnded, controlStream.Close())
}
