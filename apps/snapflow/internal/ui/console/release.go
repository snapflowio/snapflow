// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"errors"
	"fmt"

	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/systemd"
	"github.com/snapflowio/snapflow/internal/install"
	"github.com/snapflowio/snapflow/internal/ui/cli"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
	"github.com/snapflowio/snapflow/internal/ui/console/local"
	"github.com/snapflowio/snapflow/internal/ui/console/view"
	"github.com/spf13/cobra"
)

const (
	repositoryOriginFlag = "repository-origin"
	bootstrapRootFlag    = "bootstrap-root"
)

type releaseCommand struct {
	help            text.Help
	run             func(*install.Manager) (any, error)
	done            string
	failed          string
	developmentOnly bool
}

func newReleaseCommand(application *App) *cobra.Command {
	help := text.HelpRelease()
	command := &cobra.Command{Use: help.Use, Short: help.Short, Hidden: true, Args: cobra.NoArgs}
	command.RunE = func(*cobra.Command, []string) error { return command.Help() }
	command.AddCommand(
		newReleaseActionCommand(application, releaseCommand{
			help: text.HelpReleaseVerify(), done: text.ReleaseVerifiedTitle, failed: text.ReleaseVerifyFailed,
			run: func(manager *install.Manager) (any, error) { return manager.Verify() },
		}),
		newReleaseActionCommand(application, releaseCommand{
			help: text.HelpReleaseReset(), done: text.ReleaseResetDone, failed: text.ReleaseResetFailed, developmentOnly: true,
			run: func(manager *install.Manager) (any, error) { return manager.Reset() },
		}),
		newReleaseInstallCommand(application),
		newSystemFilesCommand(application),
	)
	return command
}

func newReleaseActionCommand(application *App, spec releaseCommand) *cobra.Command {
	selection := cli.ProfileFlags{}
	jsonOutput, yes := false, false
	command := &cobra.Command{Use: spec.help.Use, Short: spec.help.Short, Args: cobra.NoArgs}
	command.RunE = application.action(command, func(console *cli.Console) error {
		if spec.developmentOnly {
			if err := requireDevelopmentReset(console, selection, yes); err != nil {
				return err
			}
		}
		manager, err := releaseManager(selection)
		if err != nil {
			return err
		}
		result, err := spec.run(manager)
		if err != nil {
			return fmt.Errorf("%s: %w", spec.failed, err)
		}
		if jsonOutput {
			return writeJSON(console.Out, result)
		}
		fmt.Fprintln(console.Out, view.Success(spec.done))
		return nil
	})
	selection.Register(command)
	command.Flags().BoolVar(&jsonOutput, jsonFlag, false, text.FlagJSON)
	if spec.developmentOnly {
		command.Flags().BoolVarP(&yes, yesFlag, "y", false, text.FlagYes)
	}
	return command
}

func requireDevelopmentReset(console *cli.Console, selection cli.ProfileFlags, yes bool) error {
	profile, err := selection.Name()
	if err != nil {
		return err
	}
	if profile != config.Development {
		return cli.Fail(cli.ExitConfigurationError, errors.New(text.ReleaseResetDevelopmentOnly), "")
	}
	return confirm(console, yes, text.ResetConfirm)
}

func newReleaseInstallCommand(application *App) *cobra.Command {
	flags := releaseFlags{}
	help := text.HelpReleaseInstall()
	jsonOutput := false
	command := &cobra.Command{Use: help.Use, Short: help.Short, Args: cobra.NoArgs}
	command.RunE = application.action(command, func(console *cli.Console) error {
		profile, err := flags.releaseProfile()
		if err != nil {
			return err
		}
		record, err := install.Install(command.Context(), profile, profile.Channel)
		if err != nil {
			return fmt.Errorf("%s: %w", text.ReleaseInstallFailed, err)
		}
		if jsonOutput {
			return writeJSON(console.Out, record)
		}
		fmt.Fprintln(console.Out, view.Success(text.ReleaseInstalledTitle))
		fmt.Fprintln(console.Out, view.Row(text.LabelRelease, record.Version))
		return nil
	})
	flags.profile.Register(command)
	command.Flags().StringVar(&flags.repositoryRoot, repositoryOriginFlag, "", text.FlagRepositoryOrigin)
	command.Flags().StringVar(&flags.bootstrapRoot, bootstrapRootFlag, "", text.FlagBootstrapRoot)
	command.Flags().BoolVar(&jsonOutput, jsonFlag, false, text.FlagJSON)
	return command
}

func newSystemFilesCommand(application *App) *cobra.Command {
	selection := cli.ProfileFlags{}
	command := &cobra.Command{Use: local.SystemFilesCommand, Short: text.SystemFilesShort, Args: cobra.NoArgs}
	command.RunE = application.action(command, func(console *cli.Console) error {
		profile, err := selection.Name()
		if err != nil {
			return err
		}
		if profile != config.Production {
			return cli.Fail(cli.ExitConfigurationError, errors.New(text.SystemFilesProductionOnly), "")
		}
		return local.InstallSystemFiles(command.Context(), local.ExecCommandRunner{}, systemd.Bus{}, console.Err, console.Err)
	})
	selection.Register(command)
	return command
}

type releaseFlags struct {
	profile        cli.ProfileFlags
	repositoryRoot string
	bootstrapRoot  string
}

func (flags releaseFlags) releaseProfile() (config.Profile, error) {
	name, err := flags.profile.Name()
	if err != nil {
		return config.Profile{}, err
	}
	return config.ReleaseProfile(name, config.RepositorySource{
		Origin: flags.repositoryRoot, BootstrapRoot: flags.bootstrapRoot,
	})
}

func releaseManager(selection cli.ProfileFlags) (*install.Manager, error) {
	profile, err := selection.Runtime()
	if err != nil {
		return nil, err
	}
	manager, err := install.New(install.ProfileConfig(profile))
	if err != nil {
		return nil, fmt.Errorf("initialize Snapflow release manager: %w", err)
	}
	return manager, nil
}
