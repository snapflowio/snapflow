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
	"time"

	tea "charm.land/bubbletea/v2"
	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/view"
	"github.com/spf13/cobra"
)

const (
	watchFlag             = "watch"
	intervalFlag          = "interval"
	defaultWatchInterval  = 5 * time.Second
	minimumWatchInterval  = time.Second
	watchIntervalTooShort = "--interval must be at least 1s"
)

type statusOptions struct {
	profile  cli.ProfileFlags
	json     bool
	watch    bool
	interval time.Duration
}

func newStatusCommand(application *App) *cobra.Command {
	options := statusOptions{}
	help := text.HelpStatus()
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, Long: help.Long,
		Example: help.Example, GroupID: text.GroupOperate, Args: cobra.NoArgs,
	}
	command.RunE = application.action(command, func(console *cli.Console) error {
		return runStatus(command.Context(), console, options)
	})
	options.profile.Register(command)
	flags := command.Flags()
	flags.BoolVar(&options.json, jsonFlag, false, text.FlagJSON)
	flags.BoolVarP(&options.watch, watchFlag, "w", false, text.FlagWatch)
	flags.DurationVar(&options.interval, intervalFlag, defaultWatchInterval, text.FlagInterval)
	return command
}

func runStatus(ctx context.Context, console *cli.Console, options statusOptions) error {
	configuration, err := options.profile.Config()
	if err != nil {
		return err
	}
	statusConfig := admin.StatusConfig{Config: configuration}
	if configuration.Profile.Name != config.Development {
		statusConfig.Service, err = admin.NewServiceManager(admin.ServiceManagerConfig{
			Commands: admin.ExecCommandRunner{}, Profile: configuration.Profile.Name,
		})
		if err != nil {
			return err
		}
	}
	fetch := func() admin.StatusResult { return admin.Status(ctx, statusConfig) }
	if options.watch {
		return watchStatus(ctx, console, options, fetch)
	}
	result := fetch()
	if options.json {
		if err := writeJSON(console.Out, result); err != nil {
			return err
		}
	} else {
		fmt.Fprintln(console.Out, view.Status(console.Theme, result))
	}
	if !result.Ready {
		return cli.ExitWith(cli.ExitRuntimeError)
	}
	return nil
}

func watchStatus(ctx context.Context, console *cli.Console, options statusOptions, fetch func() admin.StatusResult) error {
	if !console.Interactive || options.json {
		return cli.Fail(cli.ExitConfigurationError, errors.New(text.WatchNeedsTerminal), text.WatchHint)
	}
	if options.interval < minimumWatchInterval {
		return cli.Fail(cli.ExitConfigurationError, errors.New(watchIntervalTooShort), text.HelpHint(text.CommandStatus))
	}
	watch, err := view.NewWatch(view.WatchConfig{Theme: console.Theme, Interval: options.interval, Fetch: fetch})
	if err != nil {
		return err
	}
	final, err := tea.NewProgram(watch, tea.WithContext(ctx), tea.WithColorProfile(console.Profile)).Run()
	if err != nil {
		return fmt.Errorf("run the status view: %w", err)
	}
	if watched, isWatch := final.(view.Watch); isWatch && !watched.Ready() {
		return cli.ExitWith(cli.ExitRuntimeError)
	}
	return nil
}
