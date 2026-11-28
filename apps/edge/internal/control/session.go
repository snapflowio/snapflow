// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/snapflowio/edge/internal/identity"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	minimumRenewalDelay  = 10 * time.Second
	renewalRetryDelay    = 5 * time.Second
	renewalDelayDivisor  = 2
	sessionComponentName = "edge_session"
	rejectedSessionCause = "the control plane rejected the session"
)

type Session struct {
	log         *slog.Logger
	api         *apiclient.ClientWithResponses
	identity    *identity.Identity
	mu          sync.RWMutex
	creds       Credentials
	expiresAt   time.Time
	reestablish chan struct{}
}

func Establish(
	ctx context.Context,
	api *apiclient.ClientWithResponses,
	edgeIdentity *identity.Identity,
	enrollmentSecret string,
	opts ...Option,
) (*Session, error) {
	if api == nil || edgeIdentity == nil {
		return nil, errors.New("edge session requires an API client and identity")
	}
	session := &Session{
		log:         newOptions(opts).logger.With(slog.String("component", sessionComponentName)),
		api:         api,
		identity:    edgeIdentity,
		reestablish: make(chan struct{}, 1),
	}
	err := session.create(ctx)
	if err == nil {
		return session, nil
	}
	if strings.TrimSpace(enrollmentSecret) == "" || !isEnrollmentRequired(err) {
		return nil, err
	}
	if err := enroll(ctx, api, edgeIdentity, enrollmentSecret); err != nil {
		return nil, err
	}
	if err := session.create(ctx); err != nil {
		return nil, err
	}
	return session, nil
}

func (session *Session) Credentials() Credentials {
	session.mu.RLock()
	defer session.mu.RUnlock()
	return session.creds
}

func (session *Session) Expiry() time.Time {
	session.mu.RLock()
	defer session.mu.RUnlock()
	return session.expiresAt
}

func (session *Session) ReportAuthenticationFailure(rejected Credentials) {
	if session.Credentials().ID != rejected.ID {
		return
	}
	select {
	case session.reestablish <- struct{}{}:
	default:
	}
}

func (session *Session) Run(ctx context.Context) error {
	for {
		timer := time.NewTimer(session.renewalDelay(time.Now()))
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil
		case <-session.reestablish:
			timer.Stop()
			if err := session.replace(ctx, rejectedSessionCause); err != nil {
				return err
			}
		case <-timer.C:
			if err := session.renewOrReplace(ctx); err != nil {
				return err
			}
		}
	}
}

func (session *Session) renewalDelay(now time.Time) time.Duration {
	delay := session.Expiry().Sub(now) / renewalDelayDivisor
	if delay < minimumRenewalDelay {
		return minimumRenewalDelay
	}
	return delay
}

func (session *Session) setExpiry(value time.Time) {
	session.mu.Lock()
	defer session.mu.Unlock()
	session.expiresAt = value
}
