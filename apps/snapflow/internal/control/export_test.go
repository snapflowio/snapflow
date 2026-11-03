// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"time"

	"github.com/snapflowio/snapflow/internal/state"
)

func ValidatePolicyRefresh(active, refreshed ControlPolicy) error {
	return validateRefresh(active, refreshed)
}

type Wait = func(context.Context, time.Duration) error

func AwaitDeviceToken(ctx context.Context, serverURL string, authorization DeviceAuthorization, wait Wait) (string, error) {
	client, err := newDeviceClient(serverURL)
	if err != nil {
		return "", err
	}
	client.wait = wait
	return client.awaitToken(ctx, authorization)
}

type RegisteredIdentity struct {
	Identity     *state.Identity
	Organization Organization
}

func RegisterIdentity(ctx context.Context, cfg RegistrationConfig, wait Wait) (RegisteredIdentity, error) {
	registered, err := registerIdentity(ctx, cfg, wait)
	return RegisteredIdentity{
		Identity: registered.identity, Organization: registered.organization,
	}, err
}
