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

	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/systemd"
	"github.com/snapflowio/snapflow/internal/ui/cli"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
	"github.com/snapflowio/snapflow/internal/ui/console/local"
	"github.com/snapflowio/snapflow/internal/ui/console/view"
	"github.com/spf13/cobra"
)

type uninstallOptions struct {
	profile cli.ProfileFlags
	purge   bool
	yes     bool
	json    bool
}

func newUninstallCommand(application *App) *cobra.Command {
	options := uninstallOptions{}
	help := text.HelpUninstall()
	command := &cobra.Command{Use: help.Use, Short: help.Short, Example: help.Example, Args: cobra.NoArgs}
	command.RunE = application.action(command, func(console *cli.Console) error {
		return runUninstall(command.Context(), console, options)
	})
	options.profile.Register(command)
	command.Flags().BoolVar(&options.purge, purgeFlag, false, text.FlagPurge)
	command.Flags().BoolVarP(&options.yes, yesFlag, "y", false, text.FlagYes)
	command.Flags().BoolVar(&options.json, jsonFlag, false, text.FlagJSON)
	return command
}

func runUninstall(ctx context.Context, console *cli.Console, options uninstallOptions) error {
	question := text.UninstallConfirm
	if options.purge {
		question = text.PurgeConfirm
	}
	manager, err := systemService(options.profile)
	if err != nil {
		return err
	}
	configuration, err := options.profile.Config()
	if err != nil {
		return err
	}
	if err := confirm(console, options.yes, question); err != nil {
		return err
	}
	result, err := local.Uninstall(ctx, local.UninstallConfig{
		Config: configuration, Service: manager, Purge: options.purge, Log: console.Err,
	})
	if err != nil {
		return cli.Fail(cli.ExitRuntimeError, fmt.Errorf("%s: %w", text.UninstallStopped, err), text.UninstallStoppedHint)
	}
	if options.json {
		return writeJSON(console.Out, result)
	}
	fmt.Fprintln(console.Out, view.Success(text.UninstallDoneTitle))
	if result.StatePurged {
		fmt.Fprintln(console.Out, view.Success(text.UninstallPurged))
	}
	return nil
}

func systemService(selection cli.ProfileFlags) (*local.ServiceManager, error) {
	profile, err := selection.Name()
	if err != nil {
		return nil, err
	}
	if profile == config.Development {
		return nil, cli.Fail(cli.ExitConfigurationError, errors.New(text.DevelopmentService), text.DevelopmentHint)
	}
	return local.NewServiceManager(local.ServiceManagerConfig{Commands: local.ExecCommandRunner{}, Systemd: systemd.Bus{}, Profile: profile})
}
