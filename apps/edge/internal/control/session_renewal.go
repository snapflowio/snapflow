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
	"math"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/common-go/pkg/apierror"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	createSessionOperation = "create Edge session"
	renewSessionOperation  = "renew Edge session"
	expiredSessionCause    = "the session expired before it could be renewed"
)

func (session *Session) renewOrReplace(ctx context.Context) error {
	for {
		expiresAt, err := session.renew(ctx)
		if err == nil {
			session.setExpiry(expiresAt)
			session.log.DebugContext(ctx, "Edge control session renewed", "expires_at", expiresAt)
			return nil
		}
		if ctx.Err() != nil {
			return nil
		}
		if !isRetryableSessionError(err) {
			return session.replace(ctx, err.Error())
		}
		if !time.Now().Before(session.Expiry()) {
			return session.replace(ctx, expiredSessionCause)
		}
		session.log.WarnContext(ctx, "Edge control session renewal failed; retrying", "error", err)
		if !reconnect.Wait(ctx, renewalRetryDelay) {
			return nil
		}
	}
}

func (session *Session) replace(ctx context.Context, reason string) error {
	session.log.WarnContext(ctx, "Re-establishing Edge control session", "reason", reason)
	for {
		err := session.create(ctx)
		if err == nil {
			session.log.InfoContext(
				ctx,
				"Edge control session re-established",
				"generation", session.Credentials().Generation,
			)
			return nil
		}
		if ctx.Err() != nil {
			return nil
		}
		if !isRetryableSessionError(err) {
			return fmt.Errorf("re-establish Edge control session: %w", err)
		}
		session.log.WarnContext(ctx, "Edge control session creation failed; retrying", "error", err)
		if !reconnect.Wait(ctx, renewalRetryDelay) {
			return nil
		}
	}
}

func (session *Session) create(ctx context.Context) error {
	proof, err := session.identity.SessionProof(time.Now())
	if err != nil {
		return fmt.Errorf("create Edge session proof: %w", err)
	}
	edgeID, err := uuid.Parse(session.identity.EdgeID())
	if err != nil {
		return fmt.Errorf("parse Edge ID: %w", err)
	}
	result, err := session.api.CreateEdgeSessionWithResponse(ctx, apiclient.CreateEdgeSessionDto{
		IssuedAt:  proof.IssuedAt,
		Nonce:     proof.Nonce,
		Signature: proof.Signature,
		EdgeId:    edgeID,
	})
	if err := apierror.CheckResponse(createSessionOperation, result, err); err != nil {
		return err
	}
	created := result.JSON201
	if created == nil || created.ExpiresAt.IsZero() || created.Generation > math.MaxInt32 {
		return errors.New("create Edge session returned an invalid response")
	}
	credentials := Credentials{
		ID: created.Id.String(), Token: created.Token,
		Generation: int32(created.Generation), IssuedAt: proof.IssuedAt,
	}
	if err := credentials.Validate(); err != nil {
		return fmt.Errorf("invalid Edge session response: %w", err)
	}
	session.mu.Lock()
	defer session.mu.Unlock()
	if credentials.Generation <= session.creds.Generation {
		return fmt.Errorf(
			"edge session generation %d does not advance %d",
			credentials.Generation,
			session.creds.Generation,
		)
	}
	session.creds = credentials
	session.expiresAt = created.ExpiresAt
	return nil
}

func (session *Session) renew(ctx context.Context) (time.Time, error) {
	credentials := session.Credentials()
	result, err := session.api.RenewEdgeSessionWithResponse(ctx, &apiclient.RenewEdgeSessionParams{
		XSnapflowEdgeSessionId:    credentials.ID,
		XSnapflowEdgeSessionToken: credentials.Token,
	})
	if err := apierror.CheckResponse(renewSessionOperation, result, err); err != nil {
		return time.Time{}, err
	}
	renewed := result.JSON200
	if renewed == nil || renewed.ExpiresAt.IsZero() {
		return time.Time{}, errors.New("renew Edge session returned an invalid response")
	}
	return renewed.ExpiresAt, nil
}

func isEnrollmentRequired(err error) bool {
	return apierror.HasStatus(err, http.StatusForbidden) || apierror.HasStatus(err, http.StatusUnauthorized)
}

func isRetryableSessionError(err error) bool {
	statusCode, found := apierror.StatusOf(err)
	return !found || apierror.RetryableStatus(statusCode)
}
