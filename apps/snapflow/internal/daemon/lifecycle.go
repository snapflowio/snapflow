// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import "context"

func (daemon *Daemon) run(ctx context.Context) error {
	ready, err := daemon.bootstrap(ctx)
	if err != nil {
		return daemon.startupFailed(ctx, err)
	}
	dataplaneContext, stopDataplane := context.WithCancel(context.WithoutCancel(ctx))
	dataplane := newStage(dataplaneContext, stopDataplane)
	preparationContext, cancelPreparation := context.WithTimeout(ctx, daemon.cfg.Runtime.PreparationTimeout)
	defer cancelPreparation()
	prepared, err := daemon.assemble(preparationContext, dataplaneContext, ready)
	if err != nil {
		return daemon.abortStartup(ctx, dataplane, err)
	}
	dataplane.start(prepared.dataplane)
	if err := prepared.health.ReportReady(preparationContext); err != nil {
		return daemon.abortStartup(ctx, dataplane, phaseError(PhasePublishReady, err))
	}
	cancelPreparation()
	intake := newStage(context.WithCancel(dataplaneContext))
	intake.start(prepared.intake)
	signaled := false
	select {
	case <-ctx.Done():
		signaled = true
		daemon.logger.Info("Signal received, shutting down")
	case <-dataplane.Done():
	case <-intake.Done():
	}
	if failure := daemon.drain(ctx, dataplane, intake); failure != nil {
		daemon.logger.Error("Snapflow service ended", "error", failure)
		return failure
	}
	daemon.logger.Info("Shutdown complete")
	if signaled {
		return nil
	}
	return ErrStopped
}
