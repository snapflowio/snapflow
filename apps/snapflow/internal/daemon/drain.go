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

	"github.com/snapflowio/snapflow/internal/health"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const startupFailureReason = "Snapflow startup did not complete phase: "

func (daemon *Daemon) drain(ctx context.Context, dataplane, intake *stage) error {
	intakeFailure := stop(intake)
	daemon.publishFinalReadiness(ctx, apiclient.MachineReadinessStateDraining, "")
	dataplaneFailure := stop(dataplane)
	return errors.Join(dataplaneFailure, intakeFailure)
}

func stop(group *stage) error {
	group.Stop()
	return group.Wait()
}

// startupFailed reports why startup stopped. A shutdown that interrupts
// startup, including one that lands while readiness is still being published,
// is a drain rather than a failure.
func (daemon *Daemon) startupFailed(ctx context.Context, err error) error {
	if ctx.Err() != nil {
		daemon.publishFinalReadiness(ctx, apiclient.MachineReadinessStateDraining, "")
		daemon.logger.Info("Snapflow startup canceled", "error", err)
		return nil
	}
	var failed *PhaseError
	if errors.As(err, &failed) {
		daemon.publishFinalReadiness(ctx, apiclient.MachineReadinessStateFailed, startupFailureReason+string(failed.Phase))
	}
	daemon.logger.Error("Snapflow startup failed", "error", err)
	return err
}

func (daemon *Daemon) abortStartup(ctx context.Context, dataplane *stage, err error) error {
	result := daemon.startupFailed(ctx, err)
	if failure := stop(dataplane); failure != nil {
		daemon.logger.Warn("Snapflow service ended during startup", "error", failure)
	}
	return result
}

func (daemon *Daemon) publishFinalReadiness(ctx context.Context, state apiclient.MachineReadinessState, reason string) {
	if daemon.client == nil {
		return
	}
	reportContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), daemon.cfg.Health.Timeout)
	defer cancel()
	if err := health.ReportReadiness(reportContext, daemon.client, daemon.options.version, state, reason); err != nil {
		daemon.logger.Warn("Failed to publish final machine readiness", "state", state, "error", err)
	}
}
