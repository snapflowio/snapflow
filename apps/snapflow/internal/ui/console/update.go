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

	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/supplychain/tuf"
	"github.com/snapflowio/snapflow/internal/ui/cli"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
	"github.com/snapflowio/snapflow/internal/ui/console/local"
	"github.com/snapflowio/snapflow/internal/ui/console/update"
	"github.com/snapflowio/snapflow/internal/ui/console/view"
	"github.com/spf13/cobra"
)

type updateOptions struct {
	profile   cli.ProfileFlags
	channel   string
	json      bool
	scheduled bool
}

type updateSkipped struct {
	MaintenanceWindow string `json:"maintenanceWindow"`
	Skipped           bool   `json:"skipped"`
}

func newUpdateCommand(application *App) *cobra.Command {
	options := updateOptions{}
	help := text.HelpUpdate()
	command := &cobra.Command{Use: help.Use, Short: help.Short, Hidden: true, Args: cobra.NoArgs}
	command.RunE = application.action(command, func(console *cli.Console) error {
		return runUpdate(command.Context(), console, options, application.cfg.ReleaseFilesInUse)
	})
	options.profile.Register(command)
	command.Flags().StringVar(&options.channel, channelFlag, "", text.FlagUpdateChannel)
	command.Flags().BoolVar(&options.scheduled, scheduledFlag, false, text.FlagScheduled)
	command.Flags().BoolVar(&options.json, jsonFlag, false, text.FlagJSON)
	return command
}

func runUpdate(
	ctx context.Context, console *cli.Console, options updateOptions, releaseFilesInUse update.ReleaseFilesInUse,
) error {
	profile, err := options.profile.Name()
	if err != nil {
		return err
	}
	channel, err := optionalChannel(options.channel)
	if err != nil {
		return err
	}
	if options.scheduled {
		if skipped, err := skipOutsideWindow(console, profile, options.json); skipped || err != nil {
			return err
		}
	}
	check, err := local.CheckUpdate(profile, channel)
	if err != nil {
		return maintenanceError(err)
	}
	if !check.UpdateAvailable {
		if options.json {
			return writeJSON(console.Out, check)
		}
		fmt.Fprintln(console.Out, view.Success(text.UpdateCurrent))
		return nil
	}
	manager, err := systemService(options.profile)
	if err != nil {
		return err
	}
	result, err := local.ApplyUpdate(ctx, local.MaintenanceConfig{
		Profile: profile, Channel: check.Channel, Service: manager, ReleaseFilesInUse: releaseFilesInUse, Log: console.Err,
	})
	if err != nil {
		return maintenanceError(err)
	}
	if options.json {
		return writeJSON(console.Out, result)
	}
	fmt.Fprintln(console.Out, view.Success(text.UpdateAppliedTitle))
	fmt.Fprintln(console.Out, view.Row(text.LabelRelease, result.Version))
	return nil
}

func skipOutsideWindow(console *cli.Console, profile config.ProfileName, asJSON bool) (bool, error) {
	open, window, err := local.MaintenanceWindowOpen(profile, time.Now())
	if err != nil {
		return false, maintenanceError(err)
	}
	if open {
		return false, nil
	}
	if asJSON {
		return true, writeJSON(console.Out, updateSkipped{MaintenanceWindow: window.String(), Skipped: true})
	}
	fmt.Fprintln(console.Out, view.Row(text.UpdateOutsideWindow, window.String()))
	return true, nil
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
	if errors.Is(err, local.ErrDevelopmentMaintenance) {
		return cli.Fail(cli.ExitConfigurationError, err, text.Run(text.DevelopmentBootstrapTask))
	}
	return cli.Fail(cli.ExitRuntimeError, fmt.Errorf("%s: %w", text.UpdateStopped, err), text.UpdateStoppedHint)
}
