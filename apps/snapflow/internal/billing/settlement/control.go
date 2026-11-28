// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package settlement

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/network/control"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	fetchChannelsOperation = "fetch machine settlement channels"
	settleOperation        = "settle machine channels"
	inspectDrainOperation  = "inspect whether the machine is draining"
	entityTagQuote         = `"`
	documentWait           = control.LongPollWait
)

type ControlSource interface {
	FetchChannels(ctx context.Context, digest string) (document *apiclient.MachineSettlementDocument, changed bool, err error)
	Settle(ctx context.Context, request apiclient.SettleMachineChannels) (*apiclient.HostSettlement, error)
	Draining(ctx context.Context) (bool, error)
}

type ControlPlane struct {
	client *control.Client
}

func NewControlPlane(client *control.Client) (*ControlPlane, error) {
	if client == nil {
		return nil, errors.New("settlement control-plane client is required")
	}
	return &ControlPlane{client: client}, nil
}

func (api *ControlPlane) FetchChannels(
	ctx context.Context,
	digest string,
) (*apiclient.MachineSettlementDocument, bool, error) {
	params := &apiclient.GetMachineSettlementChannelsParams{}
	if digest != "" {
		waitSeconds := int(documentWait / time.Second)
		entityTag := entityTagQuote + digest + entityTagQuote
		params.WaitSeconds, params.IfNoneMatch = &waitSeconds, &entityTag
	}
	response, err := api.client.GetMachineSettlementChannelsWithResponse(ctx, params)
	if err == nil && response.StatusCode() == http.StatusNotModified {
		return nil, false, nil
	}
	document, err := apierror.Decode(
		fetchChannelsOperation, response, err, (*apiclient.GetMachineSettlementChannelsResult).GetJSON200,
	)
	if err != nil {
		return nil, false, control.CheckRemoved(err)
	}
	return document, true, nil
}

func (api *ControlPlane) Settle(
	ctx context.Context,
	request apiclient.SettleMachineChannels,
) (*apiclient.HostSettlement, error) {
	response, err := api.client.SettleMachineChannelsWithResponse(ctx, request)
	settlement, err := apierror.Decode(settleOperation, response, err, (*apiclient.SettleMachineChannelsResult).GetJSON202)
	if err != nil {
		return nil, control.CheckRemoved(err)
	}
	return settlement, nil
}

func (api *ControlPlane) Draining(ctx context.Context) (bool, error) {
	response, err := api.client.GetInfoForAuthenticatedMachineWithResponse(ctx)
	machine, err := apierror.Decode(
		inspectDrainOperation, response, err, (*apiclient.GetInfoForAuthenticatedMachineResult).GetJSON200,
	)
	if err != nil {
		return false, control.CheckRemoved(err)
	}
	return machine.Draining || machine.State == apiclient.MachineStateDraining, nil
}
