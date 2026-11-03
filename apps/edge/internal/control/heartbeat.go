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

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	heartbeatInterval       = 10 * time.Second
	heartbeatTimeout        = 8 * time.Second
	minimumHeartbeatSpacing = 200 * time.Millisecond
)

func (coordinator *Coordinator) runHeartbeat(ctx context.Context) {
	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()
	acknowledgementChanges := coordinator.status.BindingAcknowledgementChanges()
	for {
		reportedAt := time.Now()
		coordinator.reportControlFailure(ctx, heartbeatControlOperation, coordinator.heartbeat(ctx))
		var delay time.Duration
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		case <-coordinator.heartbeatRequests:
			delay = minimumHeartbeatSpacing - time.Since(reportedAt)
		case <-acknowledgementChanges:
			delay = minimumHeartbeatSpacing - time.Since(reportedAt)
		}
		if !reconnect.Wait(ctx, delay) {
			return
		}
	}
}

func (coordinator *Coordinator) heartbeat(ctx context.Context) error {
	coordinator.heartbeatMu.Lock()
	defer coordinator.heartbeatMu.Unlock()
	capacity := coordinator.capacitySnapshot()
	activeAccessSessionIDs := coordinator.reportedAccessSessionIDs()
	bindingAcknowledgements := coordinator.status.BindingAcknowledgements()
	requestContext, cancel := context.WithTimeout(ctx, heartbeatTimeout)
	defer cancel()
	response, err := coordinator.control.Heartbeat(
		requestContext,
		apiclient.EdgeHeartbeatDto{
			StartedAt:               coordinator.startedAt,
			Version:                 coordinator.version,
			RouteTableVersion:       coordinator.routes.Load().Version(),
			Capacity:                capacity,
			ActiveAccessSessionIds:  &activeAccessSessionIDs,
			BindingAcknowledgements: &bindingAcknowledgements,
			RouteListeners:          coordinator.status.ListenerStatuses(),
		},
	)
	if err != nil {
		return err
	}
	if response == nil {
		return errors.New("edge heartbeat returned an empty control response")
	}
	if err := validateCapacityProfile(response.CapacityProfile); err != nil {
		return err
	}
	coordinator.applyAccessSessionDecisions(response)
	coordinator.applyPlacementConstraint(capacity, response.CapacityProfile)
	return nil
}

func (coordinator *Coordinator) reportedAccessSessionIDs() []string {
	sessionIDs := coordinator.status.ReportAccessSessions()
	result := make([]string, 0, len(sessionIDs))
	for _, sessionID := range sessionIDs {
		result = append(result, sessionID.String())
	}
	return result
}

func (coordinator *Coordinator) applyPlacementConstraint(
	capacity apiclient.EdgeCapacitySnapshotDto,
	profile apiclient.EdgeCapacityProfileDto,
) {
	wasConstrained := coordinator.placementConstrained.Load()
	constrained, constraintReasons := coordinator.placementConstraint.observe(capacity, profile)
	coordinator.placementConstrained.Store(constrained)
	if constrained != wasConstrained {
		coordinator.logger.Info(
			"edge placement eligibility changed",
			"placement_eligible",
			!constrained,
			"constraints",
			constraintReasons,
		)
	}
}

func (coordinator *Coordinator) applyAccessSessionDecisions(
	response *apiclient.EdgeHeartbeatResponseDto,
) {
	for _, session := range response.AccessSessions {
		coordinator.status.ConfirmAccessSession(session.SessionId, session.ExpiresAt)
	}
	revoked := response.RevokedAccessSessionIds
	sessionIDs := make([]uuid.UUID, 0, len(revoked))
	for _, value := range revoked {
		sessionID, err := uuid.Parse(value)
		if err != nil {
			coordinator.logger.Warn("ignored malformed access session revocation", "session_id", value, "error", err)
			continue
		}
		sessionIDs = append(sessionIDs, sessionID)
	}
	coordinator.status.RevokeAccessSessions(sessionIDs)
}
