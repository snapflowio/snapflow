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

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/update"
	"github.com/snapflowio/snapflow/internal/console/view"
	"github.com/snapflowio/snapflow/internal/tuf"
	"github.com/spf13/cobra"
)

const (
	checkFlag   = "check"
	channelFlag = "channel"
)

type maintenanceOperation func(context.Context, admin.MaintenanceConfig) (update.Result, error)

type updateOptions struct {
	profile cli.ProfileFlags
	channel string
	check   bool
	yes     bool
	json    bool
}

func newUpdateCommand(application *App) *cobra.Command {
	options := updateOptions{}
	help := text.HelpUpdate()
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, Long: help.Long,
		Example: help.Example, GroupID: text.GroupMaintain, Args: cobra.NoArgs,
	}
	command.RunE = application.action(command, func(console *cli.Console) error {
		return runUpdate(command.Context(), console, options)
	})
	options.profile.Register(command)
	command.Flags().StringVar(&options.channel, channelFlag, "", text.FlagUpdateChannel)
	command.Flags().BoolVar(&options.check, checkFlag, false, text.FlagCheck)
	command.Flags().BoolVarP(&options.yes, yesFlag, "y", false, text.FlagYes)
	command.Flags().BoolVar(&options.json, jsonFlag, false, text.FlagJSON)
	return command
}

func runUpdate(ctx context.Context, console *cli.Console, options updateOptions) error {
	profile, err := options.profile.Name()
	if err != nil {
		return err
	}
	channel, err := optionalChannel(options.channel)
	if err != nil {
		return err
	}
	check, err := admin.CheckUpdate(profile, channel)
	if err != nil {
		return maintenanceError(err)
	}
	if options.check || !check.UpdateAvailable {
		if options.json {
			return writeJSON(console.Out, check)
		}
		fmt.Fprintln(console.Out, view.UpdateCheck(console.Theme, string(profile), check))
		return nil
	}
	if err := confirm(console, options.yes, text.UpdateConfirm(check.AvailableVersion)); err != nil {
		return err
	}
	return runMaintenance(ctx, console, options.profile, check.Channel, options.json, admin.ApplyUpdate, text.UpdateAppliedTitle)
}

func newRollbackCommand(application *App) *cobra.Command {
	selection := cli.ProfileFlags{}
	yes, jsonOutput := false, false
	help := text.HelpRollback()
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, Example: help.Example,
		GroupID: text.GroupMaintain, Args: cobra.NoArgs,
	}
	command.RunE = application.action(command, func(console *cli.Console) error {
		if err := confirm(console, yes, text.RollbackConfirm); err != nil {
			return err
		}
		return runMaintenance(command.Context(), console, selection, "", jsonOutput, admin.Rollback, text.RollbackDoneTitle)
	})
	selection.Register(command)
	command.Flags().BoolVarP(&yes, yesFlag, "y", false, text.FlagYes)
	command.Flags().BoolVar(&jsonOutput, jsonFlag, false, text.FlagJSON)
	return command
}

func runMaintenance(
	ctx context.Context,
	console *cli.Console,
	selection cli.ProfileFlags,
	channel tuf.Channel,
	jsonOutput bool,
	operation maintenanceOperation,
	doneTitle string,
) error {
	manager, err := systemService(selection)
	if err != nil {
		return err
	}
	profile, err := selection.Name()
	if err != nil {
		return err
	}
	result, err := operation(ctx, admin.MaintenanceConfig{Profile: profile, Channel: channel, Service: manager, Log: console.Err})
	if err != nil {
		return maintenanceError(err)
	}
	if jsonOutput {
		return writeJSON(console.Out, result)
	}
	fmt.Fprintln(console.Out, view.Success(console.Theme, doneTitle))
	fmt.Fprintln(console.Out, view.Row(console.Theme, text.LabelRelease,
		console.Theme.Value.Render(result.Version)))
	return nil
}

func optionalChannel(value string) (tuf.Channel, error) {
	if value == "" {
		return "", nil
	}
	channel, err := tuf.ParseChannel(value)
	if err != nil {
		return "", cli.Fail(cli.ExitConfigurationError, err, "")
	}
	return channel, nil
}

func maintenanceError(err error) error {
	if errors.Is(err, admin.ErrDevelopmentMaintenance) {
		return cli.Fail(cli.ExitConfigurationError, err, text.Run(text.DevelopmentBootstrapTask))
	}
	return err
}
