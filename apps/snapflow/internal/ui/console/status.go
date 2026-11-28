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

	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/systemd"
	"github.com/snapflowio/snapflow/internal/ui/cli"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
	"github.com/snapflowio/snapflow/internal/ui/console/local"
	"github.com/snapflowio/snapflow/internal/ui/console/view"
	"github.com/spf13/cobra"
)

type statusOptions struct {
	profile cli.ProfileFlags
	json    bool
}

func newStatusCommand(application *App) *cobra.Command {
	options := statusOptions{}
	help := text.HelpStatus()
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, Long: help.Long, Example: help.Example, Args: cobra.NoArgs,
	}
	command.RunE = application.action(command, func(console *cli.Console) error {
		return runStatus(command.Context(), console, options)
	})
	options.profile.Register(command)
	command.Flags().BoolVar(&options.json, jsonFlag, false, text.FlagJSON)
	return command
}

func runStatus(ctx context.Context, console *cli.Console, options statusOptions) error {
	configuration, err := options.profile.Config()
	if err != nil {
		return err
	}
	statusConfig := local.StatusConfig{Config: configuration}
	if configuration.Profile.Name != config.Development {
		statusConfig.Service, err = local.NewServiceManager(local.ServiceManagerConfig{
			Commands: local.ExecCommandRunner{}, Systemd: systemd.Bus{}, Profile: configuration.Profile.Name,
		})
		if err != nil {
			return err
		}
	}
	result := local.Status(ctx, statusConfig)
	if options.json {
		if err := writeJSON(console.Out, result); err != nil {
			return err
		}
	} else {
		fmt.Fprintln(console.Out, view.Status(result))
	}
	if !result.Ready {
		return cli.ExitWith(cli.ExitRuntimeError)
	}
	return nil
}
