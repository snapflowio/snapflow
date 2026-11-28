// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"errors"
	"time"

	"github.com/snapflowio/snapflow/internal/foundation/systemd"
	"github.com/snapflowio/snapflow/internal/network/control"
)

const (
	startupFailureGrace = time.Minute
	servingStatus       = "serving sandboxes"
)

func (daemon *Daemon) run(ctx context.Context) error {
	ready, err := daemon.bootstrap(ctx)
	if err != nil {
		return daemon.startupFailed(ctx, err)
	}
	dataplaneContext, stopDataplane := context.WithCancel(context.WithoutCancel(ctx))
	dataplane := newStage(dataplaneContext, stopDataplane)
	preparationContext, cancelPreparation := context.WithTimeout(ctx, daemon.cfg.Runtime.PreparationTimeout)
	defer cancelPreparation()
	daemon.notify(systemd.ExtendTimeout(daemon.cfg.Runtime.PreparationTimeout + startupFailureGrace))
	prepared, err := daemon.assemble(preparationContext, dataplaneContext, ready)
	if err != nil {
		return daemon.abortStartup(ctx, dataplane, err)
	}
	dataplane.start(prepared.dataplane)
	if err := prepared.health.ReportReady(preparationContext); err != nil {
		return daemon.abortStartup(ctx, dataplane, phaseError(PhasePublishReady, err))
	}
	cancelPreparation()
	daemon.notify(systemd.Status(servingStatus))
	intake := newStage(context.WithCancel(dataplaneContext))
	intake.start(prepared.intake)
	signaled := daemon.supervise(ctx, dataplane, intake, prepared.runtime)
	daemon.notifyStopping()
	return daemon.drained(ctx, daemon.drain(ctx, dataplane, intake), signaled)
}

func (daemon *Daemon) drained(ctx context.Context, failure error, signaled bool) error {
	switch {
	case errors.Is(failure, control.ErrMachineRemoved):
		daemon.retire(ctx)
		return failure
	case failure != nil:
		daemon.logger.Error("Snapflow service ended", "error", failure)
		return failure
	}
	daemon.logger.Info("Shutdown complete")
	if signaled {
		return nil
	}
	return ErrStopped
}

func (daemon *Daemon) supervise(ctx context.Context, dataplane, intake *stage, probe healthProbe) bool {
	dog := daemon.startWatchdog()
	defer dog.stop()
	for {
		select {
		case <-ctx.Done():
			daemon.logger.Info("Signal received, shutting down")
			return true
		case <-dataplane.Done():
			return false
		case <-intake.Done():
			return false
		case <-dog.ticks():
			daemon.ping(ctx, dog, probe)
		}
	}
}
