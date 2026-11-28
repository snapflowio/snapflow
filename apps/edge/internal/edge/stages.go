// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"context"
)

func (server *Server) runStages(ctx context.Context, relay *relayAssembly) error {
	relayContext, cancelRelay := context.WithCancel(ctx)
	defer cancelRelay()
	controlContext, cancelControl := context.WithCancel(ctx)
	defer cancelControl()
	relayResult := make(chan error, 1)
	go func() {
		err := supervise(relayContext, relay.components, relay.drainPlan())
		cancelControl()
		relayResult <- err
	}()
	controlErr := server.runControl(controlContext, relay)
	cancelRelay()
	relayErr := <-relayResult
	if ctx.Err() != nil {
		return nil
	}
	if relayErr != nil {
		return relayErr
	}
	return controlErr
}

func (server *Server) runControl(ctx context.Context, relay *relayAssembly) error {
	assembled, err := server.assemble(ctx, relay)
	if err != nil {
		if ctx.Err() != nil {
			return nil
		}
		return err
	}
	return supervise(ctx, assembled.components, assembled.drainPlan())
}
