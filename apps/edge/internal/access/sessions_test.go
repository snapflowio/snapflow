// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

const (
	testAbsoluteSessionLifetime = time.Hour
	testShortSessionLifetime    = 50 * time.Millisecond
	testExpiryWait              = 2 * time.Second
)

func TestRevocationCancelsLiveRequestsAndRefusesNewOnes(t *testing.T) {
	t.Parallel()
	sessions := NewSessions()
	sessionID := uuid.New()
	absolute := time.Now().Add(testAbsoluteSessionLifetime)
	ctx, cancel := context.WithCancel(context.Background())
	if _, allowed := sessions.Begin(sessionID, absolute, cancel); !allowed {
		t.Fatal("first request of a session was refused")
	}
	if reported := sessions.Report(); len(reported) != 1 || reported[0] != sessionID {
		t.Fatalf("reported sessions = %v, want %s", reported, sessionID)
	}
	sessions.Revoke([]uuid.UUID{sessionID})
	if !errors.Is(ctx.Err(), context.Canceled) {
		t.Fatal("revocation did not cancel the live request")
	}
	if _, allowed := sessions.Begin(sessionID, absolute, func() {}); allowed {
		t.Fatal("a revoked session started a new request")
	}
	if len(sessions.Report()) != 0 {
		t.Fatal("a revoked session is still reported")
	}
}

func TestSessionIsReportedWhileInUseThenForgotten(t *testing.T) {
	t.Parallel()
	sessions := NewSessions()
	sessionID := uuid.New()
	absolute := time.Now().Add(testAbsoluteSessionLifetime)
	requestID, allowed := sessions.Begin(sessionID, absolute, func() {})
	if !allowed {
		t.Fatal("request refused")
	}
	sessions.End(sessionID, requestID)
	if reported := sessions.Report(); len(reported) != 1 {
		t.Fatal("a request between reports did not keep its session reported")
	}
	if reported := sessions.Report(); len(reported) != 0 {
		t.Fatalf("an idle session was still reported: %v", reported)
	}
}

func TestLiveRequestEndsWhenItsSessionExpiresWithoutRenewal(t *testing.T) {
	t.Parallel()
	sessions := NewSessions()
	sessionID := uuid.New()
	sessions.Confirm(sessionID, time.Now().Add(testShortSessionLifetime))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if _, allowed := sessions.Begin(sessionID, time.Now().Add(testAbsoluteSessionLifetime), cancel); !allowed {
		t.Fatal("request refused before the session expired")
	}
	select {
	case <-ctx.Done():
	case <-time.After(testExpiryWait):
		t.Fatal("an unrenewed session kept its live request open")
	}
}

func TestRenewalKeepsLiveRequestOpenPastItsFirstExpiry(t *testing.T) {
	t.Parallel()
	sessions := NewSessions()
	sessionID := uuid.New()
	sessions.Confirm(sessionID, time.Now().Add(testShortSessionLifetime))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if _, allowed := sessions.Begin(sessionID, time.Now().Add(testAbsoluteSessionLifetime), cancel); !allowed {
		t.Fatal("request refused")
	}
	sessions.Confirm(sessionID, time.Now().Add(testAbsoluteSessionLifetime))
	select {
	case <-ctx.Done():
		t.Fatal("a renewed session ended its live request")
	case <-time.After(testShortSessionLifetime * 4):
	}
}

func TestUnconfirmedSessionNeverServesPastItsAbsoluteExpiry(t *testing.T) {
	t.Parallel()
	sessions := NewSessions()
	if _, allowed := sessions.Begin(uuid.New(), time.Now().Add(-time.Second), func() {}); allowed {
		t.Fatal("a session past its absolute expiry started a request")
	}
}

func TestExpiredSessionCannotReopenAGraceWindow(t *testing.T) {
	t.Parallel()
	sessions := NewSessions()
	sessionID := uuid.New()
	absolute := time.Now().Add(testAbsoluteSessionLifetime)
	sessions.Confirm(sessionID, time.Now().Add(testShortSessionLifetime))
	deadline := time.Now().Add(testExpiryWait)
	for time.Now().Before(deadline) {
		if _, allowed := sessions.Begin(sessionID, absolute, func() {}); !allowed {
			return
		}
		time.Sleep(testShortSessionLifetime)
	}
	t.Fatal("a session kept serving after its window passed without renewal")
}

func TestFullTrackerEvictsTheLeastRecentlyUsedIdleSession(t *testing.T) {
	t.Parallel()
	sessions := NewSessions()
	absolute := time.Now().Add(testAbsoluteSessionLifetime)
	busyID := uuid.New()
	if _, allowed := sessions.Begin(busyID, absolute, func() {}); !allowed {
		t.Fatal("first session refused")
	}
	for range maximumTrackedSessions - 1 {
		sessions.Confirm(uuid.New(), absolute)
	}
	newcomer := uuid.New()
	if _, allowed := sessions.Begin(newcomer, absolute, func() {}); !allowed {
		t.Fatal("a full tracker refused a new session instead of evicting an idle one")
	}
	if len(sessions.sessions) != maximumTrackedSessions {
		t.Fatalf("tracked sessions = %d, want %d", len(sessions.sessions), maximumTrackedSessions)
	}
	if sessions.sessions[busyID] == nil {
		t.Fatal("a session with a request in flight was evicted")
	}
}
