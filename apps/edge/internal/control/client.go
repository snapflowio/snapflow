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
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/edge/internal/availability"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	apiOutageGrace           = 15 * time.Second
	apiAvailabilityService   = "edge Snapflow API"
	heartbeatOperation       = "report Edge heartbeat"
	protectedAccessOperation = "redeem protected access grant"
	usageCheckpointOperation = "ingest Edge usage checkpoint"
	usageEpochOperation      = "open Edge usage epoch"
	routeTableOperation      = "fetch Edge route table"
	speedtestKeysOperation   = "fetch speedtest token keys"
)

type Client struct {
	session      *Session
	api          *apiclient.ClientWithResponses
	availability *availability.Monitor
}

func NewClient(
	api *apiclient.ClientWithResponses,
	session *Session,
) (*Client, error) {
	if api == nil || session == nil {
		return nil, errors.New("edge control client requires an API client and session")
	}
	apiAvailability, err := availability.NewMonitor(
		apiAvailabilityService,
		apiOutageGrace,
	)
	if err != nil {
		return nil, fmt.Errorf("initialize Snapflow API availability monitor: %w", err)
	}
	return &Client{
		session:      session,
		api:          api,
		availability: apiAvailability,
	}, nil
}

func (client *Client) Heartbeat(
	ctx context.Context,
	input apiclient.EdgeHeartbeatDto,
) (*apiclient.EdgeHeartbeatResponseDto, error) {
	return invoke(client, heartbeatOperation, func(credentials Credentials) (*apiclient.ReportEdgeHeartbeatResult, error) {
		return client.api.ReportEdgeHeartbeatWithResponse(ctx, &apiclient.ReportEdgeHeartbeatParams{
			XSnapflowEdgeSessionId:    credentials.ID,
			XSnapflowEdgeSessionToken: credentials.Token,
		}, input)
	}, (*apiclient.ReportEdgeHeartbeatResult).GetJSON200)
}

func (client *Client) RedeemProtectedAccessGrant(
	ctx context.Context,
	input apiclient.RedeemProtectedAccessGrantDto,
) (*apiclient.ProtectedAccessGrantRedemptionDto, error) {
	return invoke(client, protectedAccessOperation, func(credentials Credentials) (*apiclient.RedeemProtectedAccessGrantResult, error) {
		return client.api.RedeemProtectedAccessGrantWithResponse(ctx, &apiclient.RedeemProtectedAccessGrantParams{
			XSnapflowEdgeSessionId:    credentials.ID,
			XSnapflowEdgeSessionToken: credentials.Token,
		}, input)
	}, (*apiclient.RedeemProtectedAccessGrantResult).GetJSON200)
}

func (client *Client) IngestUsageCheckpoint(
	ctx context.Context,
	checkpoint apiclient.EdgeUsageCheckpointDto,
) (*apiclient.EdgeUsageCheckpointAcknowledgementDto, error) {
	return invoke(client, usageCheckpointOperation, func(credentials Credentials) (*apiclient.IngestEdgeUsageCheckpointResult, error) {
		return client.api.IngestEdgeUsageCheckpointWithResponse(ctx, &apiclient.IngestEdgeUsageCheckpointParams{
			XSnapflowEdgeSessionId:    credentials.ID,
			XSnapflowEdgeSessionToken: credentials.Token,
		}, checkpoint)
	}, (*apiclient.IngestEdgeUsageCheckpointResult).GetJSON200)
}

func (client *Client) OpenUsageEpoch(ctx context.Context) (*apiclient.EdgeUsageEpochDto, error) {
	return invoke(client, usageEpochOperation, func(credentials Credentials) (*apiclient.OpenEdgeUsageEpochResult, error) {
		return client.api.OpenEdgeUsageEpochWithResponse(ctx, &apiclient.OpenEdgeUsageEpochParams{
			XSnapflowEdgeSessionId:    credentials.ID,
			XSnapflowEdgeSessionToken: credentials.Token,
		})
	}, (*apiclient.OpenEdgeUsageEpochResult).GetJSON200)
}

func invoke[R apierror.Result, T any](
	client *Client,
	operation string,
	call func(Credentials) (R, error),
	payload func(R) *T,
) (*T, error) {
	credentials := client.session.Credentials()
	result, err := call(credentials)
	value, requestErr := apierror.Decode(operation, result, err, payload)
	client.observe(operation, credentials, requestErr)
	return value, requestErr
}

func (client *Client) observe(
	operation string,
	credentials Credentials,
	err error,
) {
	if isAuthenticationFailure(err) {
		client.session.ReportAuthenticationFailure(credentials)
	}
	if err == nil || !IsRetryable(err) {
		client.availability.Success(operation)
		return
	}
	client.availability.Failure(operation, err)
}

func (client *Client) SpeedtestTokenKeys(ctx context.Context) ([]apiclient.SpeedtestTokenKey, error) {
	keys, err := invoke(client, speedtestKeysOperation, func(credentials Credentials) (*apiclient.ListEdgeSpeedtestTokenKeysResult, error) {
		return client.api.ListEdgeSpeedtestTokenKeysWithResponse(ctx, &apiclient.ListEdgeSpeedtestTokenKeysParams{
			XSnapflowEdgeSessionId:    credentials.ID,
			XSnapflowEdgeSessionToken: credentials.Token,
		})
	}, (*apiclient.ListEdgeSpeedtestTokenKeysResult).GetJSON200)
	if err != nil {
		return nil, err
	}
	return *keys, nil
}
