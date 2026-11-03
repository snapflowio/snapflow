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

const (
	samplesFlag    = "samples"
	defaultSamples = 20
)

func newBenchmarkCommand(application *App) *cobra.Command {
	selection := cli.ProfileFlags{}
	samples := defaultSamples
	jsonOutput := false
	help := text.HelpBenchmark()
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, GroupID: text.GroupAdvanced, Args: cobra.NoArgs,
	}
	command.RunE = application.action(command, func(console *cli.Console) error {
		configuration, err := selection.Config()
		if err != nil {
			return err
		}
		report, err := doctor.Benchmark(command.Context(), configuration, samples)
		if err != nil {
			return err
		}
		if jsonOutput {
			return writeJSON(console.Out, report)
		}
		fmt.Fprintln(console.Out, view.Benchmark(console.Theme, report))
		return nil
	})
	selection.Register(command)
	command.Flags().IntVar(&samples, samplesFlag, samples, text.FlagSamples)
	command.Flags().BoolVar(&jsonOutput, jsonFlag, false, text.FlagJSON)
	return command
}
