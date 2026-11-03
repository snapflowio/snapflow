// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

func (registry *Registry) readHeartbeats(
	ctx context.Context,
	session *machineSession,
	stream transport.Stream,
) error {
	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()
	var sequence uint64
	for {
		sequence++
		heartbeat, err := exchangeHeartbeat(stream, sequence)
		if err != nil {
			return err
		}
		if err := registry.applyHeartbeat(session, heartbeat); err != nil {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func exchangeHeartbeat(stream transport.Stream, sequence uint64) (protocol.HeartbeatResponse, error) {
	var heartbeat protocol.HeartbeatResponse
	if err := stream.SetDeadline(time.Now().Add(heartbeatResponseTimeout)); err != nil {
		return heartbeat, fmt.Errorf("set Machine heartbeat deadline: %w", err)
	}
	if err := protocol.WriteFrame(stream, protocol.HeartbeatRequest{
		Version:  protocol.Version,
		Sequence: sequence,
	}); err != nil {
		return heartbeat, fmt.Errorf("write Machine heartbeat request: %w", err)
	}
	if err := protocol.ReadFrameLimit(
		stream,
		&heartbeat,
		protocol.MaxHeartbeatFrameBytes,
	); err != nil {
		return heartbeat, fmt.Errorf("read Machine heartbeat response: %w", err)
	}
	if err := heartbeat.Validate(); err != nil {
		return heartbeat, fmt.Errorf("validate Machine heartbeat response: %w", err)
	}
	if heartbeat.Sequence != sequence {
		return heartbeat, fmt.Errorf(
			"machine heartbeat sequence is %d, expected %d",
			heartbeat.Sequence,
			sequence,
		)
	}
	if err := stream.SetDeadline(time.Time{}); err != nil {
		return heartbeat, fmt.Errorf("clear Machine heartbeat deadline: %w", err)
	}
	return heartbeat, nil
}

func (registry *Registry) applyHeartbeat(session *machineSession, heartbeat protocol.HeartbeatResponse) error {
	if heartbeat.Binding != session.binding {
		registry.bindingFenceRejections.Add(1)
		return errors.New("machine heartbeat acknowledged a different binding")
	}
	if !registry.routes.Load().HasBinding(
		session.machineID,
		session.machineSessionGeneration,
		session.binding,
		time.Now(),
	) {
		registry.bindingFenceRejections.Add(1)
		return errors.New("machine tunnel binding expired or was replaced")
	}
	if heartbeat.Draining && !session.draining.Swap(true) {
		registry.logger.Debug("Machine tunnel session is draining", "machine_id", session.machineID, "session_id", session.sessionID)
	}
	registry.markAcknowledged(session)
	return nil
}
