// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type redeemedSession struct {
	id                uuid.UUID
	expiresAt         time.Time
	absoluteExpiresAt time.Time
}

func validateRedemption(
	redemption *apiclient.ProtectedAccessGrantRedemptionDto,
	route routes.HTTP,
	now time.Time,
) (redeemedSession, error) {
	if err := validateRedemptionTarget(redemption, route); err != nil {
		return redeemedSession{}, err
	}
	absoluteExpiresAt := redemption.AbsoluteExpiresAt
	if !absoluteExpiresAt.After(now) || absoluteExpiresAt.After(now.Add(maximumSessionLifetime)) {
		return redeemedSession{}, errors.New("protected grant session absolute expiration is invalid")
	}
	expiresAt := redemption.ExpiresAt
	if !expiresAt.After(now) || expiresAt.After(absoluteExpiresAt) {
		return redeemedSession{}, errors.New("protected grant session expiration is invalid")
	}
	sessionID := redemption.SessionId
	if sessionID == uuid.Nil {
		return redeemedSession{}, errors.New("protected grant session is invalid")
	}
	return redeemedSession{id: sessionID, expiresAt: expiresAt, absoluteExpiresAt: absoluteExpiresAt}, nil
}

func validateRedemptionTarget(
	redemption *apiclient.ProtectedAccessGrantRedemptionDto,
	route routes.HTTP,
) error {
	if redemption.BackendId != route.BackendID {
		return errors.New("protected grant backend does not match route")
	}
	if redemption.SandboxId != route.SandboxID {
		return errors.New("protected grant runtime does not match route")
	}
	if redemption.ExposureId != route.ExposureID ||
		redemption.ExposureName != route.ExposureName {
		return errors.New("protected grant exposure does not match route")
	}
	if redemption.TargetPort != int32(route.TargetPort) {
		return errors.New("protected grant target port does not match route")
	}
	if redemption.Interactive != route.Interactive {
		return errors.New("protected grant interaction mode does not match route")
	}
	return nil
}

func RequiredBackend(
	request *http.Request,
	routes []routes.HTTP,
) (uuid.UUID, bool) {
	if backendID, hinted := grantBackendHint(request); hinted {
		return backendID, true
	}
	if token := presentedToken(request); token != "" {
		return tokenBackend(token)
	}
	for _, candidate := range routes {
		cookie, err := request.Cookie(cookieName(candidate.BackendID))
		if err == nil && cookie.Value != "" {
			return candidate.BackendID, true
		}
	}
	return uuid.Nil, false
}

func grantBackendHint(request *http.Request) (uuid.UUID, bool) {
	if !hasGrant(request) {
		return uuid.Nil, false
	}
	value := strings.TrimSpace(request.URL.Query().Get(BackendQueryParameter))
	backendID, err := uuid.Parse(value)
	if err != nil || backendID.String() != value {
		return uuid.Nil, false
	}
	return backendID, true
}

func hasGrant(request *http.Request) bool {
	return strings.TrimSpace(request.URL.Query().Get(GrantQueryParameter)) != ""
}
