// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"context"
	"fmt"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/view"
	"github.com/spf13/cobra"
)

const purgeFlag = "purge"

type uninstallOptions struct {
	profile cli.ProfileFlags
	purge   bool
	yes     bool
	json    bool
}

func newUninstallCommand(application *App) *cobra.Command {
	options := uninstallOptions{}
	help := text.HelpUninstall()
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, Example: help.Example,
		GroupID: text.GroupMaintain, Args: cobra.NoArgs,
	}
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
	result, err := admin.Uninstall(ctx, admin.UninstallConfig{
		Config: configuration, Service: manager, Purge: options.purge, Log: console.Err,
	})
	if err != nil {
		return err
	}
	if options.json {
		return writeJSON(console.Out, result)
	}
	fmt.Fprintln(console.Out, view.Success(console.Theme, text.UninstallDoneTitle))
	if result.StatePurged {
		fmt.Fprintln(console.Out, view.Success(console.Theme, text.UninstallPurged))
	}
	return nil
}
