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
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/common-go/pkg/apierror"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	renewalFraction           = 2
	minimumRenewalDelay       = 10 * time.Second
	renewalRetryDelay         = 5 * time.Second
	creationRetryMinimumDelay = time.Second
	creationRetryMaximumDelay = 30 * time.Second
	creationRetryFactor       = 2
	creationRetryJitter       = 0.2
	createSessionOperation    = "create machine session"
	closeSessionOperation     = "close machine session"
	renewSessionOperation     = "renew machine session"
)

type SessionCredentials struct {
	ID         string
	Generation uint32
}

func (c SessionCredentials) Validate() error {
	if strings.TrimSpace(c.ID) == "" || c.Generation == 0 {
		return errors.New("machine session generation is required")
	}
	return nil
}

type Session struct {
	log       *slog.Logger
	client    *Client
	creds     SessionCredentials
	expiryMu  sync.RWMutex
	expiresAt time.Time
	closeOnce sync.Once
	closeErr  error
}

func CreateSession(ctx context.Context, client *Client, machineID string, opts ...Option) (*Session, error) {
	if client == nil {
		return nil, errors.New("machine session control-plane client is required")
	}
	logger := newOptions(opts).logger
	if strings.TrimSpace(machineID) == "" {
		return nil, errors.New("registered machine identity is required")
	}
	backoff := reconnect.Backoff{
		Minimum: creationRetryMinimumDelay,
		Maximum: creationRetryMaximumDelay,
		Factor:  creationRetryFactor,
		Jitter:  creationRetryJitter,
	}
	return createWithRetry(ctx, logger, backoff, func() (*Session, error) {
		return createOnce(ctx, logger, client, machineID)
	})
}

func createOnce(
	ctx context.Context,
	logger *slog.Logger,
	client *Client,
	machineID string,
) (*Session, error) {
	machineUUID, err := uuid.Parse(machineID)
	if err != nil {
		return nil, fmt.Errorf("parse machine ID: %w", err)
	}
	result, err := client.CreateMachineSessionWithResponse(ctx, apiclient.CreateMachineSessionDto{MachineId: machineUUID})
	created, err := apierror.Decode(createSessionOperation, result, err, (*apiclient.CreateMachineSessionResult).GetJSON201)
	if err != nil {
		return nil, err
	}
	if created.TokenType != apiclient.MachineSessionDtoTokenTypeDPoP {
		return nil, errors.New("machine session response has an unsupported token type")
	}
	generation := created.Generation
	if generation <= 0 {
		return nil, errors.New("machine session response has an invalid generation")
	}
	credentials := SessionCredentials{
		ID:         created.SessionId.String(),
		Generation: uint32(generation),
	}
	if err := credentials.Validate(); err != nil {
		return nil, fmt.Errorf("invalid machine session response: %w", err)
	}
	if created.ExpiresAt.IsZero() {
		return nil, errors.New("machine session response has no expiration")
	}
	if err := client.ActivateSession(created.Token); err != nil {
		return nil, fmt.Errorf("activate machine session: %w", err)
	}
	return &Session{
		log:       logger.With(slog.String("component", "machine_session")),
		client:    client,
		creds:     credentials,
		expiresAt: created.ExpiresAt,
	}, nil
}

func createWithRetry(
	ctx context.Context,
	logger *slog.Logger,
	backoff reconnect.Backoff,
	attempt func() (*Session, error),
) (*Session, error) {
	for {
		service, err := attempt()
		if err == nil {
			return service, nil
		}
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		if !apierror.IsRetryable(err) {
			return nil, err
		}
		delay := backoff.Next()
		logger.WarnContext(
			ctx,
			"Control plane is unavailable; retrying machine session creation",
			"error", err,
			"retry_in", delay,
		)
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, ctx.Err()
		case <-timer.C:
		}
	}
}

func (s *Session) Credentials() SessionCredentials {
	return s.creds
}

func (s *Session) Close(ctx context.Context) error {
	s.closeOnce.Do(func() {
		defer s.client.ClearSession()
		result, err := s.client.CloseMachineSessionWithResponse(ctx)
		s.closeErr = apierror.CheckResponse(closeSessionOperation, result, err)
	})
	return s.closeErr
}

func (s *Session) Run(ctx context.Context) error {
	for reconnect.Wait(ctx, s.renewalDelay(time.Now())) {
		if err := s.renewUntilSuccess(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (s *Session) renewUntilSuccess(ctx context.Context) error {
	for {
		expiresAt, err := s.renew(ctx)
		switch {
		case err == nil:
			s.setExpiry(expiresAt)
			s.log.DebugContext(ctx, "Machine session renewed", "expires_at", expiresAt)
			return nil
		case ctx.Err() != nil:
			return nil
		case apierror.IsPermanent(err):
			return err
		case !time.Now().Before(s.expiry()):
			return fmt.Errorf("machine session expired after renewal failure: %w", err)
		}
		s.log.WarnContext(ctx, "Machine session renewal failed; retrying", "error", err)
		if !reconnect.Wait(ctx, renewalRetryDelay) {
			return nil
		}
	}
}

func (s *Session) renew(ctx context.Context) (time.Time, error) {
	result, err := s.client.RenewMachineSessionWithResponse(ctx)
	renewed, err := apierror.Decode(renewSessionOperation, result, err, (*apiclient.RenewMachineSessionResult).GetJSON200)
	if err != nil {
		return time.Time{}, err
	}
	if renewed.ExpiresAt.IsZero() {
		return time.Time{}, errors.New("renew machine session returned no expiration")
	}
	return renewed.ExpiresAt, nil
}

func (s *Session) renewalDelay(now time.Time) time.Duration {
	remaining := time.Until(s.expiry())
	if !now.IsZero() {
		remaining = s.expiry().Sub(now)
	}
	delay := remaining / renewalFraction
	if delay < minimumRenewalDelay {
		return minimumRenewalDelay
	}
	return delay
}

func (s *Session) expiry() time.Time {
	s.expiryMu.RLock()
	defer s.expiryMu.RUnlock()
	return s.expiresAt
}

func (s *Session) setExpiry(value time.Time) {
	s.expiryMu.Lock()
	defer s.expiryMu.Unlock()
	s.expiresAt = value
}
