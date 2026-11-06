// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"github.com/spf13/cobra"
)

const (
	machineGroupUse   = "machine"
	machineGroupShort = "Install, approve, and operate a Snapflow machine"
)

func newMachineCommand(application *App) *cobra.Command {
	group := &cobra.Command{Use: machineGroupUse, Short: machineGroupShort, Args: cobra.NoArgs}
	group.AddCommand(
		newSetupCommand(application),
		newStatusCommand(application),
		newPayoutCommand(application),
		newVouchersCommand(application),
		newDoctorCommand(application),
		newLogsCommand(application),
		newStartCommand(application),
		newStopCommand(application),
		newUpdateCommand(application),
		newRollbackCommand(application),
		newUninstallCommand(application),
		newBenchmarkCommand(application),
		newReleaseCommand(application),
	)
	return group
}
