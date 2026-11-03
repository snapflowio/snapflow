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
	"time"

	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	routeReadTimeout         = 30 * time.Second
	routeReadFailureDelay    = time.Second
	minimumRouteReadInterval = 250 * time.Millisecond
)

var errEmptyRouteRead = errors.New(
	"edge route table read returned neither a snapshot nor not-modified",
)

func (coordinator *Coordinator) runRouteRefresh(ctx context.Context) {
	failureBackoff := reconnect.DefaultBackoff()
	for {
		startedAt := time.Now()
		var delay time.Duration
		if err := coordinator.refreshRoutes(ctx); err != nil {
			coordinator.reportControlFailure(ctx, routeControlOperation, err)
			delay = max(routeReadFailureDelay, failureBackoff.Next())
		} else {
			failureBackoff.Reset()
			delay = minimumRouteReadInterval - time.Since(startedAt)
		}
		if !reconnect.Wait(ctx, delay) {
			return
		}
	}
}

func (coordinator *Coordinator) refreshRoutes(ctx context.Context) error {
	knownDigest := coordinator.routes.Load().Digest()
	requestContext, cancel := context.WithTimeout(ctx, routeReadTimeout)
	defer cancel()
	read, err := coordinator.control.Routes(requestContext, knownDigest)
	if err != nil {
		coordinator.routes.RecordRefreshFailure()
		return err
	}
	if read.NotModified {
		coordinator.routeAvailability.Success(routeApplicationOperation)
		return nil
	}
	applyErr := errEmptyRouteRead
	if read.Snapshot != nil {
		applyErr = coordinator.routes.Apply(read.Snapshot)
	}
	if applyErr != nil {
		coordinator.routes.RecordRefreshFailure()
		coordinator.routeAvailability.Failure(routeApplicationOperation, applyErr)
		return nil
	}
	coordinator.routeAvailability.Success(routeApplicationOperation)
	coordinator.requestHeartbeat()
	return nil
}

func (coordinator *Coordinator) requestHeartbeat() {
	select {
	case coordinator.heartbeatRequests <- struct{}{}:
	default:
	}
}
