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
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	GrantQueryParameter    = "SNAPFLOW_ACCESS_GRANT"
	BackendQueryParameter  = "SNAPFLOW_ACCESS_ENDPOINT"
	redeemTimeout          = 5 * time.Second
	maximumSessionLifetime = 8 * time.Hour
	noReferrerPolicy       = "no-referrer"
	SigningKeyBytes        = 32
)

type DenialReason string

const (
	DenialReasonGrantMethod     DenialReason = "grant_method"
	DenialReasonGrantFormat     DenialReason = "grant_format"
	DenialReasonCrossOrigin     DenialReason = "cross_origin"
	DenialReasonGrantRedemption DenialReason = "grant_redemption"
	DenialReasonGrantValidation DenialReason = "grant_validation"
	DenialReasonSessionCreation DenialReason = "session_creation"
	DenialReasonSessionMissing  DenialReason = "session_missing"
	DenialReasonSessionInvalid  DenialReason = "session_invalid"
	DenialReasonWebSocketOrigin DenialReason = "websocket_origin"
)

type GrantRedeemer interface {
	RedeemProtectedAccessGrant(
		ctx context.Context,
		input apiclient.RedeemProtectedAccessGrantDto,
	) (*apiclient.ProtectedAccessGrantRedemptionDto, error)
}

type Decision struct {
	Authorized        bool
	Responded         bool
	DenialReason      DenialReason
	AbsoluteExpiresAt time.Time
	SessionID         uuid.UUID
}

type Gate struct {
	logger     *slog.Logger
	redeemer   GrantRedeemer
	signingKey []byte
	sessions   *Sessions
}

func NewGate(
	redeemer GrantRedeemer,
	signingKey []byte,
	sessions *Sessions,
	opts ...Option,
) (*Gate, error) {
	if redeemer == nil || sessions == nil || len(signingKey) != SigningKeyBytes {
		return nil, errors.New(
			"protected access requires a redeemer, a session tracker, and a 32-byte signing key",
		)
	}
	return &Gate{
		logger:     newOptions(opts).logger,
		redeemer:   redeemer,
		signingKey: append([]byte(nil), signingKey...),
		sessions:   sessions,
	}, nil
}

func (gate *Gate) Authorize(
	writer http.ResponseWriter,
	request *http.Request,
	route routes.HTTP,
) Decision {
	if route.Policy.Visibility == routes.HTTPVisibilityPublic {
		return Decision{Authorized: true}
	}
	grant := strings.TrimSpace(request.URL.Query().Get(GrantQueryParameter))
	request.URL.RawQuery = withoutAccessParameters(request.URL.RawQuery)
	if grant != "" {
		return gate.redeemGrant(writer, request, route, grant)
	}
	tokens, presented := sessionCredentials(request, route.BackendID)
	if len(tokens) == 0 {
		return Decision{DenialReason: DenialReasonSessionMissing}
	}
	absoluteExpiresAt, sessionID, valid := gate.verifyAny(tokens, route.BackendID, time.Now())
	if !valid {
		return Decision{DenialReason: DenialReasonSessionInvalid}
	}
	if !presented {
		if web.IsWebSocketUpgrade(request) && !web.IsSameOrigin(request) {
			return Decision{DenialReason: DenialReasonWebSocketOrigin}
		}
		if !web.AllowsUnsafeRequest(request, trustedOrigin(request, route)) {
			return Decision{DenialReason: DenialReasonCrossOrigin}
		}
	}
	return Decision{
		Authorized:        true,
		AbsoluteExpiresAt: absoluteExpiresAt,
		SessionID:         sessionID,
	}
}

func (gate *Gate) verifyAny(
	tokens []string,
	backendID uuid.UUID,
	now time.Time,
) (time.Time, uuid.UUID, bool) {
	for _, token := range tokens {
		if absoluteExpiresAt, sessionID, valid := gate.verifyToken(token, backendID, now); valid {
			return absoluteExpiresAt, sessionID, true
		}
	}
	return time.Time{}, uuid.Nil, false
}

func (gate *Gate) redeemGrant(
	writer http.ResponseWriter,
	request *http.Request,
	route routes.HTTP,
	grant string,
) Decision {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		return Decision{DenialReason: DenialReasonGrantMethod}
	}
	if !isWellFormedGrant(grant) {
		return Decision{DenialReason: DenialReasonGrantFormat}
	}
	redeemContext, cancel := context.WithTimeout(request.Context(), redeemTimeout)
	defer cancel()
	redemption, err := gate.redeemer.RedeemProtectedAccessGrant(
		redeemContext,
		apiclient.RedeemProtectedAccessGrantDto{
			Token:     grant,
			BackendId: route.BackendID,
		},
	)
	if err != nil || redemption == nil {
		gate.logger.Debug("protected access grant redemption failed", "error", err)
		return Decision{DenialReason: DenialReasonGrantRedemption}
	}
	session, err := validateRedemption(redemption, route, time.Now())
	if err != nil {
		return Decision{DenialReason: DenialReasonGrantValidation}
	}
	token, err := gate.signToken(route.BackendID, session.id, session.absoluteExpiresAt)
	if err != nil {
		return Decision{DenialReason: DenialReasonSessionCreation}
	}
	gate.sessions.Confirm(session.id, session.expiresAt)
	writer.Header().Set(web.CacheControl, web.NoStore)
	writer.Header().Set(web.ReferrerPolicy, noReferrerPolicy)
	web.ApplyCORSHeaders(writer.Header(), request, route.Policy)
	if wantsTokenRedemption(request) {
		if err := writeTokenRedemption(writer, token, session.absoluteExpiresAt); err != nil {
			gate.logger.Debug("protected access token response failed", "error", err)
		}
		return Decision{Responded: true}
	}
	setCookie(writer, route.BackendID, token, session.absoluteExpiresAt)
	http.Redirect(writer, request, sameHostLocation(request.URL), http.StatusSeeOther)
	return Decision{Responded: true}
}

func (gate *Gate) Sessions() *Sessions {
	return gate.sessions
}
