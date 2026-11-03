// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"fmt"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/doctor"
	"github.com/snapflowio/snapflow/internal/console/view"
	"github.com/spf13/cobra"
)

func newDoctorCommand(application *App) *cobra.Command {
	selection := cli.ProfileFlags{}
	jsonOutput := false
	isolation := false
	help := text.HelpDoctor()
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, Long: help.Long,
		Example: help.Example, GroupID: text.GroupOperate, Args: cobra.NoArgs,
	}
	command.RunE = application.action(command, func(console *cli.Console) error {
		ctx := command.Context()
		configuration, err := selection.Config()
		if err != nil {
			return err
		}
		cfg := doctor.DiagnoseConfig{Config: configuration, Isolation: isolation}
		if !jsonOutput {
			fmt.Fprintln(console.Out, view.Header(console.Theme, text.DoctorTitle, string(configuration.Profile.Name)))
			cfg.Observe = func(check doctor.DiagnosticCheck) { fmt.Fprintln(console.Out, view.Check(console.Theme, check)) }
		}
		report := doctor.Diagnose(ctx, cfg)
		if jsonOutput {
			if err := writeJSON(console.Out, report); err != nil {
				return err
			}
		} else {
			fmt.Fprintln(console.Out, view.DiagnosisSummary(console.Theme, report))
		}
		if !report.Ready {
			return cli.ExitWith(cli.ExitRuntimeError)
		}
		return nil
	})
	selection.Register(command)
	command.Flags().BoolVar(&isolation, isolationFlag, false, text.FlagIsolation)
	command.Flags().BoolVar(&jsonOutput, jsonFlag, false, text.FlagJSON)
	return command
}
