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

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/view"
	"github.com/snapflowio/snapflow/internal/install"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/spf13/cobra"
)

const (
	repositoryOriginFlag = "repository-origin"
	bootstrapRootFlag    = "bootstrap-root"
)

type releaseCommand[T any] struct {
	help            text.Help
	run             func(*install.Manager) (T, error)
	render          func(style.Theme, T) string
	developmentOnly bool
}

func newReleaseCommand(application *App) *cobra.Command {
	help := text.HelpRelease()
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, GroupID: text.GroupAdvanced, Args: cobra.NoArgs,
	}
	command.RunE = func(*cobra.Command, []string) error { return command.Help() }
	command.AddCommand(
		newReleaseActionCommand(application, releaseCommand[release.VerifiedRelease]{
			help: text.HelpReleaseVerify(), render: view.ReleaseVerified,
			run: func(manager *install.Manager) (release.VerifiedRelease, error) { return manager.Verify() },
		}),
		newReleaseActionCommand(application, releaseCommand[install.Status]{
			help: text.HelpReleaseStatus(), render: view.ReleaseStatus,
			run: func(manager *install.Manager) (install.Status, error) { return manager.Status() },
		}),
		newReleaseActionCommand(application, releaseCommand[view.CollectedGarbage]{
			help: text.HelpReleaseGC(), render: view.ReleaseGarbage,
			run: func(manager *install.Manager) (view.CollectedGarbage, error) {
				removed, err := manager.GarbageCollect()
				return view.CollectedGarbage{Removed: removed}, err
			},
		}),
		newReleaseActionCommand(application, releaseCommand[install.ResetResult]{
			help: text.HelpReleaseReset(), render: view.ReleaseReset, developmentOnly: true,
			run: func(manager *install.Manager) (install.ResetResult, error) { return manager.Reset() },
		}),
		newReleaseInstallCommand(application),
		newSystemFilesCommand(application),
	)
	return command
}

func newReleaseActionCommand[T any](application *App, spec releaseCommand[T]) *cobra.Command {
	selection := cli.ProfileFlags{}
	jsonOutput, yes := false, false
	command := &cobra.Command{Use: spec.help.Use, Short: spec.help.Short, Hidden: spec.developmentOnly, Args: cobra.NoArgs}
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
			return err
		}
		if jsonOutput {
			return writeJSON(console.Out, result)
		}
		fmt.Fprintln(console.Out, spec.render(console.Theme, result))
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
	command := &cobra.Command{Use: help.Use, Short: help.Short, Hidden: true, Args: cobra.NoArgs}
	command.RunE = application.action(command, func(console *cli.Console) error {
		profile, err := flags.releaseProfile()
		if err != nil {
			return err
		}
		record, err := install.Install(command.Context(), profile, profile.Channel)
		if err != nil {
			return err
		}
		if jsonOutput {
			return writeJSON(console.Out, record)
		}
		fmt.Fprintln(console.Out, view.ReleaseInstalled(console.Theme, record))
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
	command := &cobra.Command{Use: admin.SystemFilesCommand, Short: text.SystemFilesShort, Hidden: true, Args: cobra.NoArgs}
	command.RunE = application.action(command, func(console *cli.Console) error {
		profile, err := selection.Name()
		if err != nil {
			return err
		}
		if profile != config.Production {
			return cli.Fail(cli.ExitConfigurationError, errors.New(text.SystemFilesProductionOnly), "")
		}
		return admin.InstallSystemFiles(command.Context(), admin.ExecCommandRunner{}, console.Err, console.Err)
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
