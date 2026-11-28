// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/edge/internal/routes"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type RouteRead struct {
	Snapshot    *apiclient.EdgeRouteSnapshotDto
	NotModified bool
}

func (client *Client) Routes(
	ctx context.Context,
	knownDigest string,
) (RouteRead, error) {
	credentials := client.session.Credentials()
	read, err := client.readRoutes(ctx, credentials, knownDigest)
	client.observe(routeTableOperation, credentials, err)
	return read, err
}

func (client *Client) readRoutes(
	ctx context.Context,
	credentials Credentials,
	knownDigest string,
) (RouteRead, error) {
	waitSeconds := int(conditionalControlReadWait / time.Second)
	params := &apiclient.GetEdgeRouteSnapshotParams{
		WaitSeconds:               &waitSeconds,
		XSnapflowEdgeSessionId:    credentials.ID,
		XSnapflowEdgeSessionToken: credentials.Token,
	}
	if knownDigest != "" {
		entityTag := strongEntityTag(knownDigest)
		params.IfNoneMatch = &entityTag
	}
	result, err := client.api.GetEdgeRouteSnapshotWithResponse(ctx, params)
	if err == nil && result.StatusCode() == http.StatusNotModified {
		return RouteRead{NotModified: true}, nil
	}
	if err := apierror.CheckResponse(routeTableOperation, result, err); err != nil {
		return RouteRead{}, err
	}
	snapshot, err := routes.DecodeSnapshot(result.Body)
	if err != nil {
		return RouteRead{}, fmt.Errorf("%s: %w", routeTableOperation, err)
	}
	return RouteRead{Snapshot: snapshot}, nil
}

func strongEntityTag(digest string) string {
	return `"` + digest + `"`
}
