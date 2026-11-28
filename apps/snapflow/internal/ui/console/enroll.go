// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/snapflowio/snapflow/internal/agent/doctor"
	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/systemd"
	"github.com/snapflowio/snapflow/internal/network/control"
	"github.com/snapflowio/snapflow/internal/ui/cli"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
	"github.com/snapflowio/snapflow/internal/ui/console/local"
	"github.com/snapflowio/snapflow/internal/ui/console/view"
	"github.com/spf13/cobra"
)

type enrollOptions struct {
	profile cli.ProfileFlags
	channel string
	apiURL  string
	name    string
	token   string
	json    bool
	version string
}

func newEnrollCommand(application *App) *cobra.Command {
	options := enrollOptions{version: application.options.version}
	help := text.HelpEnroll()
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, Long: help.Long, Example: help.Example, Args: cobra.MaximumNArgs(1),
	}
	command.RunE = application.action(command, func(console *cli.Console) error {
		token, err := enrollmentToken(options.token, command.Flags().Args())
		if err != nil {
			return err
		}
		options.token = token
		return runEnroll(command.Context(), console, options)
	})
	options.profile.Register(command)
	flags := command.Flags()
	flags.StringVar(&options.token, tokenFlag, "", text.FlagToken)
	flags.StringVar(&options.name, nameFlag, "", text.FlagName)
	flags.StringVar(&options.apiURL, apiURLFlag, "", text.FlagAPIURL)
	flags.StringVar(&options.channel, channelFlag, "", text.FlagChannel)
	flags.BoolVar(&options.json, jsonFlag, false, text.FlagJSON)
	cli.SetEnvironmentName(command, tokenFlag, tokenEnvironment)
	return command
}

func enrollmentToken(flagToken string, arguments []string) (string, error) {
	if len(arguments) == 0 {
		return flagToken, nil
	}
	if flagToken != "" && flagToken != arguments[0] {
		return "", cli.Fail(cli.ExitConfigurationError, errors.New(text.EnrollTwoKeys), text.EnrollTwoKeysHint)
	}
	return arguments[0], nil
}

func runEnroll(ctx context.Context, console *cli.Console, options enrollOptions) error {
	profile, err := options.profile.Name()
	if err != nil {
		return err
	}
	channel, err := optionalChannel(options.channel)
	if err != nil {
		return err
	}
	cfg := local.EnrollConfig{
		Profile: profile, Channel: channel, APIURL: options.apiURL, Name: options.name,
		Token: options.token, Version: options.version, Log: console.Err,
	}
	if profile != config.Development {
		if cfg.Service, err = local.NewServiceManager(local.ServiceManagerConfig{
			Commands: local.ExecCommandRunner{}, Systemd: systemd.Bus{}, Profile: profile,
		}); err != nil {
			return err
		}
	}
	enrollment, err := local.NewEnrollment(cfg)
	if err != nil {
		return err
	}
	progress := console.Out
	if options.json {
		progress = console.Err
	}
	fmt.Fprintln(progress, view.Header(text.EnrollTitle, string(profile)))
	result, err := enrollment.Run(ctx, enrollProgress{out: progress})
	if err != nil {
		return enrollFailure(err)
	}
	if options.json {
		return writeJSON(console.Out, result)
	}
	fmt.Fprintln(console.Out)
	fmt.Fprintln(console.Out, view.Enrolled(result))
	return nil
}

type enrollProgress struct {
	out io.Writer
}

func (progress enrollProgress) PhaseStarted(phase local.EnrollProgress) {
	fmt.Fprintln(progress.out, view.EnrollPhaseStarted(phase))
}

func (progress enrollProgress) PhaseFinished(phase local.EnrollProgress) {
	if note := view.EnrollPhaseFinished(phase); note != "" {
		fmt.Fprintln(progress.out, note)
	}
}

func (progress enrollProgress) CheckCompleted(check doctor.DiagnosticCheck) {
	fmt.Fprintln(progress.out, view.Check(check))
}

func enrollFailure(err error) error {
	for _, known := range []struct {
		cause error
		code  int
		hint  string
	}{
		{cause: local.ErrHostNotReady, code: cli.ExitConfigurationError, hint: text.FailedFixPrefix + " `" + text.CommandEnroll + "`"},
		{cause: control.ErrEnrollmentKeyRequired, code: cli.ExitConfigurationError, hint: text.AddMachineHint},
		{cause: control.ErrEnrollmentKeyInvalid, code: cli.ExitConfigurationError, hint: text.KeyInvalidHint},
		{cause: control.ErrEnrollmentKeyUsed, code: cli.ExitConfigurationError, hint: text.KeyUsedHint},
		{cause: control.ErrHostKeyInUse, code: cli.ExitRuntimeError, hint: text.HostKeyInUseHint},
		{cause: control.ErrEnrollmentConflict, code: cli.ExitRuntimeError, hint: text.EnrollmentConflictHint},
		{cause: control.ErrEnrollmentRejected, code: cli.ExitRuntimeError, hint: text.ProofRejectedHint},
		{cause: local.ErrIdentityUnreadable, code: cli.ExitRuntimeError, hint: text.ReenrollHint},
		{cause: local.ErrMachineRevoked, code: cli.ExitRuntimeError, hint: text.ReenrollHint},
	} {
		if errors.Is(err, known.cause) {
			return cli.Fail(known.code, fmt.Errorf("%s: %w", text.EnrollStopped, err), known.hint)
		}
	}
	return cli.Fail(cli.ExitRuntimeError, fmt.Errorf("%s: %w", text.EnrollStopped, err), "")
}
