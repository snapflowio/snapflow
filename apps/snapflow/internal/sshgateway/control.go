// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sshgateway

import (
	"context"
	"errors"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/control"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const resolveAccessOperation = "resolve SSH access grant"

type AccessControl interface {
	ResolveSSHAccess(context.Context, string) (string, error)
}

type ControlPlane struct {
	client *control.Client
}

func NewControlPlane(client *control.Client) (*ControlPlane, error) {
	if client == nil {
		return nil, errors.New("SSH access control-plane client is required")
	}
	return &ControlPlane{client: client}, nil
}

func (api *ControlPlane) ResolveSSHAccess(ctx context.Context, token string) (string, error) {
	response, err := api.client.ResolveSshAccessRelayWithResponse(ctx, apiclient.ResolveSshRelayDto{Token: token})
	resolved, err := apierror.Decode(
		resolveAccessOperation, response, err, (*apiclient.ResolveSshAccessRelayResult).GetJSON200,
	)
	if err != nil {
		return "", err
	}
	if resolved.SandboxId == "" {
		return "", errors.New("resolve SSH access grant returned an empty sandbox")
	}
	return resolved.SandboxId, nil
}
