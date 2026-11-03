// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"context"
	"io"
	"os"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/wizard"
	"github.com/spf13/cobra"
)

const replaceFlag = "replace"

type setupOptions struct {
	profile      cli.ProfileFlags
	channel      string
	apiURL       string
	name         string
	organization string
	replace      bool
	yes          bool
	json         bool
	version      string
}

func newSetupCommand(application *App) *cobra.Command {
	options := setupOptions{version: application.options.version}
	help := text.HelpSetup()
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, Long: help.Long, Example: help.Example,
		GroupID: text.GroupStart, Args: cobra.NoArgs,
	}
	command.RunE = application.action(command, func(console *cli.Console) error {
		return runSetup(command.Context(), console, options)
	})
	options.profile.Register(command)
	flags := command.Flags()
	flags.StringVar(&options.channel, channelFlag, "", text.FlagSetupChannel)
	flags.StringVar(&options.apiURL, apiURLFlag, "", text.FlagAPIURL)
	flags.StringVar(&options.name, nameFlag, "", text.FlagName)
	flags.StringVar(&options.organization, organizationFlag, "", text.FlagOrganization)
	flags.BoolVar(&options.replace, replaceFlag, false, text.FlagReplace)
	flags.BoolVarP(&options.yes, yesFlag, "y", false, text.FlagYes)
	flags.BoolVar(&options.json, jsonFlag, false, text.FlagJSON)
	return command
}

func runSetup(ctx context.Context, console *cli.Console, options setupOptions) error {
	profile, err := options.profile.Name()
	if err != nil {
		return err
	}
	channel, err := optionalChannel(options.channel)
	if err != nil {
		return err
	}
	interactive := console.Interactive && !options.yes && !options.json
	serviceLog := console.Err
	if interactive {
		serviceLog = io.Discard
	}
	setupConfig := admin.SetupConfig{
		Profile: profile, Channel: channel, APIURL: options.apiURL, Name: options.name,
		Organization: options.organization, Replace: options.replace, Log: serviceLog,
		Version: options.version,
	}
	if profile != config.Development {
		service, err := admin.NewServiceManager(admin.ServiceManagerConfig{Commands: admin.ExecCommandRunner{}, Profile: profile})
		if err != nil {
			return err
		}
		setupConfig.Service = service
	}
	setup, err := admin.NewSetup(setupConfig)
	if err != nil {
		return err
	}
	cfg := wizard.Config{Setup: setup, Console: console, Profile: string(profile), Lookup: os.Getenv}
	switch {
	case interactive:
		return wizard.Run(ctx, cfg)
	case options.json:
		progress := *console
		progress.Out = console.Err
		cfg.Console, cfg.ResultJSON = &progress, console.Out
	}
	return wizard.Report(ctx, cfg)
}
