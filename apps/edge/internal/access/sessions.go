// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
)

const (
	maximumTrackedSessions  = 10_000
	maximumRevokedSessions  = 100_000
	unconfirmedSessionGrace = 30 * time.Second
	revocationPruneInterval = time.Minute
)

type trackedSession struct {
	requests  map[uint64]context.CancelFunc
	expiresAt time.Time
	used      bool
	lastUsed  time.Time
	timer     *time.Timer
}

type Sessions struct {
	mu          sync.Mutex
	sessions    map[uuid.UUID]*trackedSession
	revoked     map[uuid.UUID]time.Time
	nextID      uint64
	nextPruneAt time.Time
}

func NewSessions() *Sessions {
	return &Sessions{
		sessions: make(map[uuid.UUID]*trackedSession),
		revoked:  make(map[uuid.UUID]time.Time),
	}
}

func (sessions *Sessions) Begin(
	sessionID uuid.UUID,
	absoluteExpiresAt time.Time,
	cancel context.CancelFunc,
) (uint64, bool) {
	sessions.mu.Lock()
	defer sessions.mu.Unlock()
	now := time.Now()
	sessions.pruneRevocationsLocked(now)
	if revokedUntil, revoked := sessions.revoked[sessionID]; revoked && now.Before(revokedUntil) {
		return 0, false
	}
	session := sessions.sessions[sessionID]
	if session == nil {
		expiresAt := now.Add(unconfirmedSessionGrace)
		if absoluteExpiresAt.Before(expiresAt) {
			expiresAt = absoluteExpiresAt
		}
		session = sessions.trackLocked(sessionID, expiresAt)
		if session == nil {
			return 0, false
		}
	}
	if !now.Before(session.expiresAt) {
		return 0, false
	}
	sessions.nextID++
	session.requests[sessions.nextID] = cancel
	session.used = true
	session.lastUsed = now
	return sessions.nextID, true
}

func (sessions *Sessions) End(sessionID uuid.UUID, requestID uint64) {
	sessions.mu.Lock()
	defer sessions.mu.Unlock()
	if session := sessions.sessions[sessionID]; session != nil {
		delete(session.requests, requestID)
	}
}

func (sessions *Sessions) Confirm(sessionID uuid.UUID, expiresAt time.Time) {
	sessions.mu.Lock()
	defer sessions.mu.Unlock()
	if _, revoked := sessions.revoked[sessionID]; revoked {
		return
	}
	if latest := time.Now().Add(maximumSessionLifetime); expiresAt.After(latest) {
		expiresAt = latest
	}
	session := sessions.sessions[sessionID]
	if session == nil {
		sessions.trackLocked(sessionID, expiresAt)
		return
	}
	session.expiresAt = expiresAt
	sessions.armLocked(sessionID, session)
}

func (sessions *Sessions) Report() []uuid.UUID {
	sessions.mu.Lock()
	defer sessions.mu.Unlock()
	result := make([]uuid.UUID, 0, len(sessions.sessions))
	for sessionID, session := range sessions.sessions {
		if len(session.requests) == 0 && !session.used {
			sessions.forgetLocked(sessionID, session)
			continue
		}
		session.used = false
		result = append(result, sessionID)
	}
	return result
}

func (sessions *Sessions) Revoke(sessionIDs []uuid.UUID) {
	if len(sessionIDs) == 0 {
		return
	}
	now := time.Now()
	revokedUntil := now.Add(maximumSessionLifetime)
	cancellations := make([]context.CancelFunc, 0, len(sessionIDs))
	sessions.mu.Lock()
	sessions.pruneRevocationsLocked(now)
	for _, sessionID := range sessionIDs {
		if sessionID == uuid.Nil {
			continue
		}
		sessions.revokeLocked(sessionID, revokedUntil)
		if session := sessions.sessions[sessionID]; session != nil {
			cancellations = appendCancellations(cancellations, session)
			sessions.forgetLocked(sessionID, session)
		}
	}
	sessions.mu.Unlock()
	for _, cancel := range cancellations {
		cancel()
	}
}

// expire runs when a tracked session outlives its window without the control
// plane extending it. The session is tombstoned rather than forgotten, so a
// later request cannot open a fresh unconfirmed grace window while the control
// plane is unreachable: the edge fails closed.
func (sessions *Sessions) expire(sessionID uuid.UUID) {
	sessions.mu.Lock()
	session := sessions.sessions[sessionID]
	now := time.Now()
	if session == nil || now.Before(session.expiresAt) {
		sessions.mu.Unlock()
		return
	}
	cancellations := appendCancellations(nil, session)
	sessions.forgetLocked(sessionID, session)
	sessions.revokeLocked(sessionID, now.Add(maximumSessionLifetime))
	sessions.mu.Unlock()
	for _, cancel := range cancellations {
		cancel()
	}
}

func (sessions *Sessions) revokeLocked(sessionID uuid.UUID, revokedUntil time.Time) {
	if _, exists := sessions.revoked[sessionID]; !exists &&
		len(sessions.revoked) >= maximumRevokedSessions {
		sessions.evictOldestRevocationLocked()
	}
	sessions.revoked[sessionID] = revokedUntil
}

func (sessions *Sessions) trackLocked(sessionID uuid.UUID, expiresAt time.Time) *trackedSession {
	if len(sessions.sessions) >= maximumTrackedSessions && !sessions.evictIdleLocked() {
		return nil
	}
	session := &trackedSession{
		requests:  make(map[uint64]context.CancelFunc),
		expiresAt: expiresAt,
		lastUsed:  time.Now(),
	}
	sessions.sessions[sessionID] = session
	sessions.armLocked(sessionID, session)
	return session
}

func (sessions *Sessions) armLocked(sessionID uuid.UUID, session *trackedSession) {
	if session.timer != nil {
		session.timer.Stop()
	}
	session.timer = time.AfterFunc(time.Until(session.expiresAt), func() {
		sessions.expire(sessionID)
	})
}

func (sessions *Sessions) forgetLocked(sessionID uuid.UUID, session *trackedSession) {
	if session.timer != nil {
		session.timer.Stop()
	}
	delete(sessions.sessions, sessionID)
}

// evictIdleLocked frees room by forgetting the least recently used session
// with no request in flight. A forgotten session is not revoked: its next
// request is tracked again and confirmed by the control plane, so one tenant
// filling the tracker cannot lock other tenants out.
func (sessions *Sessions) evictIdleLocked() bool {
	var oldestID uuid.UUID
	var oldest *trackedSession
	for sessionID, session := range sessions.sessions {
		if len(session.requests) == 0 && (oldest == nil || session.lastUsed.Before(oldest.lastUsed)) {
			oldestID = sessionID
			oldest = session
		}
	}
	if oldest == nil {
		return false
	}
	sessions.forgetLocked(oldestID, oldest)
	return true
}

func (sessions *Sessions) pruneRevocationsLocked(now time.Time) {
	if now.Before(sessions.nextPruneAt) {
		return
	}
	sessions.nextPruneAt = now.Add(revocationPruneInterval)
	for sessionID, expiresAt := range sessions.revoked {
		if !now.Before(expiresAt) {
			delete(sessions.revoked, sessionID)
		}
	}
}

func (sessions *Sessions) evictOldestRevocationLocked() {
	var oldestID uuid.UUID
	var oldestExpiry time.Time
	for sessionID, expiresAt := range sessions.revoked {
		if oldestID == uuid.Nil || expiresAt.Before(oldestExpiry) {
			oldestID = sessionID
			oldestExpiry = expiresAt
		}
	}
	if oldestID != uuid.Nil {
		delete(sessions.revoked, oldestID)
	}
}

func appendCancellations(cancellations []context.CancelFunc, session *trackedSession) []context.CancelFunc {
	for _, cancel := range session.requests {
		cancellations = append(cancellations, cancel)
	}
	return cancellations
}
