// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"fmt"

	"github.com/snapflowio/edge/internal/control"
	"github.com/snapflowio/edge/internal/telemetry"
)

func (server *Server) openObservation(assembled *assembly) error {
	hostSampler := server.options.hostSampler
	if hostSampler == nil {
		sampler, err := telemetry.NewHostSampler()
		if err != nil {
			return fmt.Errorf("initialize edge host metrics: %w", err)
		}
		hostSampler = sampler
	}
	coordinator, err := control.NewCoordinator(
		assembled.client,
		assembled.routes,
		assembled,
		hostSampler,
		server.options.version,
		control.WithLogger(server.options.logger),
	)
	if err != nil {
		return err
	}
	assembled.coordinator = coordinator
	metrics, err := telemetry.NewServer(server.config.Telemetry, assembled)
	if err != nil {
		return err
	}
	assembled.telemetry = metrics
	return nil
}
