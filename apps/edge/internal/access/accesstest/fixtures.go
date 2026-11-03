// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package accesstest

import (
	"bytes"
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/access"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web/webtest"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	testTargetPort = 8080
	signingKeyByte = 1
)

var _ access.GrantRedeemer = StubRedeemer{}

type StubRedeemer struct {
	Redemption apiclient.ProtectedAccessGrantRedemptionDto
}

func (redeemer StubRedeemer) RedeemProtectedAccessGrant(
	ctx context.Context,
	input apiclient.RedeemProtectedAccessGrantDto,
) (*apiclient.ProtectedAccessGrantRedemptionDto, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	redemption := redeemer.Redemption
	return &redemption, nil
}

func ProtectedRoute() routes.HTTP {
	return routes.HTTP{
		Base: routes.Base{
			BackendID:    uuid.New(),
			SandboxID:    "sandbox-test",
			ExposureID:   uuid.New(),
			ExposureName: "web",
			TargetPort:   testTargetPort,
		},
		Policy: routes.HTTPPolicy{Visibility: routes.HTTPVisibilityProtected},
	}
}

func DashboardRoute() routes.HTTP {
	route := ProtectedRoute()
	route.Policy.AllowedOrigins = []string{webtest.DashboardOrigin}
	route.Policy.AllowCredentials = true
	return route
}

func NewGate(
	t *testing.T,
	route routes.HTTP,
	sessionID uuid.UUID,
	sessions *access.Sessions,
) *access.Gate {
	t.Helper()
	gate, err := access.NewGate(StubRedeemer{Redemption: apiclient.ProtectedAccessGrantRedemptionDto{
		BackendId:         route.BackendID,
		SandboxId:         route.SandboxID,
		ExposureId:        route.ExposureID,
		ExposureName:      route.ExposureName,
		TargetPort:        int32(route.TargetPort),
		SessionId:         sessionID,
		ExpiresAt:         time.Now().Add(time.Minute),
		AbsoluteExpiresAt: time.Now().Add(time.Hour),
	}}, bytes.Repeat([]byte{signingKeyByte}, access.SigningKeyBytes), sessions)
	if err != nil {
		t.Fatalf("create protected access: %v", err)
	}
	return gate
}
