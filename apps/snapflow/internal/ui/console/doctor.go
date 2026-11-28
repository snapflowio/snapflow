// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"fmt"

	"github.com/snapflowio/snapflow/internal/agent/doctor"
	"github.com/snapflowio/snapflow/internal/ui/cli"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
	"github.com/snapflowio/snapflow/internal/ui/console/view"
	"github.com/spf13/cobra"
)

type doctorOptions struct {
	profile   cli.ProfileFlags
	json      bool
	isolation bool
	benchmark bool
	samples   int
}

func newDoctorCommand(application *App) *cobra.Command {
	options := doctorOptions{samples: defaultSamples}
	help := text.HelpDoctor()
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, Long: help.Long, Example: help.Example, Args: cobra.NoArgs,
	}
	command.RunE = application.action(command, func(console *cli.Console) error {
		return runDoctor(command, console, options)
	})
	options.profile.Register(command)
	flags := command.Flags()
	flags.BoolVar(&options.isolation, isolationFlag, false, text.FlagIsolation)
	flags.BoolVar(&options.benchmark, benchmarkFlag, false, text.FlagBenchmark)
	flags.IntVar(&options.samples, samplesFlag, options.samples, text.FlagSamples)
	flags.BoolVar(&options.json, jsonFlag, false, text.FlagJSON)
	return command
}

func runDoctor(command *cobra.Command, console *cli.Console, options doctorOptions) error {
	configuration, err := options.profile.Config()
	if err != nil {
		return err
	}
	cfg := doctor.DiagnoseConfig{Config: configuration, Isolation: options.isolation}
	if options.benchmark {
		cfg.BenchmarkSamples = options.samples
	}
	if !options.json {
		fmt.Fprintln(console.Out, view.Header(text.DoctorTitle, string(configuration.Profile.Name)))
		cfg.Observe = func(check doctor.DiagnosticCheck) { fmt.Fprintln(console.Out, view.Check(check)) }
	}
	report := doctor.Diagnose(command.Context(), cfg)
	if options.json {
		if err := writeJSON(console.Out, report); err != nil {
			return err
		}
	} else {
		if report.Benchmark != nil {
			fmt.Fprintln(console.Out, "")
			fmt.Fprintln(console.Out, view.Benchmark(*report.Benchmark))
		}
		fmt.Fprintln(console.Out, "")
		fmt.Fprintln(console.Out, view.DiagnosisSummary(report))
	}
	if !report.Ready {
		return cli.ExitWith(cli.ExitRuntimeError)
	}
	return nil
}
