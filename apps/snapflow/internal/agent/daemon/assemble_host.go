// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"

	"github.com/snapflowio/snapflow/internal/agent/abuse"
	"github.com/snapflowio/snapflow/internal/agent/doctor"
	"github.com/snapflowio/snapflow/internal/agent/hostreport"
)

func (daemon *Daemon) prepareHostSettings(ready *foundation, prepared *services) error {
	controlPlane, err := hostreport.NewControlPlane(daemon.client)
	if err != nil {
		return err
	}
	cfg := daemon.cfg
	prepared.hostReports, err = hostreport.New(hostreport.Dependencies{
		Control: controlPlane,
		Store:   ready.database,
		Diagnose: func(ctx context.Context) doctor.Diagnosis {
			return doctor.Diagnose(ctx, doctor.DiagnoseConfig{Config: cfg})
		},
		LoadBenchmark: func() (*doctor.BenchmarkReport, error) { return doctor.LoadBenchmark(cfg) },
		Logger:        daemon.logger,
	})
	if err != nil {
		return err
	}
	prepared.abuseMonitor, err = abuse.NewMonitor(prepared.runtime, prepared.localRuntimes, controlPlane, daemon.logger)
	if err != nil {
		return err
	}
	prepared.hostSettings = &hostSettingsWatcher{daemon: daemon}
	return nil
}
