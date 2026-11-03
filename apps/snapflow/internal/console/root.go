// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/spf13/cobra"
)

func newRootCommand(application *App) *cobra.Command {
	help := text.HelpRoot()
	root := &cobra.Command{
		Use:           help.Use,
		Short:         help.Short,
		Long:          help.Long,
		Version:       application.options.version,
		Args:          cobra.NoArgs,
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	root.RunE = func(*cobra.Command, []string) error { return root.Help() }
	root.SetIn(application.cfg.In)
	root.SetOut(application.cfg.Out)
	root.SetErr(application.cfg.Err)
	root.PersistentFlags().BoolVar(&application.noColor, noColorFlag, false, text.FlagNoColor)
	root.SetFlagErrorFunc(func(failed *cobra.Command, err error) error {
		return cli.Fail(cli.ExitConfigurationError, err, text.HelpHint(failed.CommandPath()))
	})
	root.AddGroup(
		&cobra.Group{ID: text.GroupStart, Title: text.GroupStartTitle},
		&cobra.Group{ID: text.GroupOperate, Title: text.GroupOperateTitle},
		&cobra.Group{ID: text.GroupMaintain, Title: text.GroupMaintainTitle},
		&cobra.Group{ID: text.GroupAdvanced, Title: text.GroupAdvancedTitle},
	)
	exposeAtTop(root, newMachineCommand(application))
	return root
}

func exposeAtTop(root, group *cobra.Command) {
	commands := group.Commands()
	group.RemoveCommand(commands...)
	root.AddCommand(commands...)
}
