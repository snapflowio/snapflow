// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"fmt"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/view"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/spf13/cobra"
)

func newPayoutCommand(application *App) *cobra.Command {
	selection := cli.ProfileFlags{}
	jsonOutput := false
	help := text.HelpPayout()
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, Long: help.Long,
		Example: help.Example, GroupID: text.GroupOperate, Args: cobra.NoArgs,
	}
	command.RunE = application.action(command, func(console *cli.Console) error {
		configuration, err := selection.Config()
		if err != nil {
			return err
		}
		result, err := admin.Payout(command.Context(), configuration)
		if err != nil {
			return err
		}
		if jsonOutput {
			if err := writeJSON(console.Out, result); err != nil {
				return err
			}
		} else {
			fmt.Fprintln(console.Out, view.Payout(console.Theme, result))
		}
		if result.Readiness != apiclient.PayoutReadinessReady {
			return cli.ExitWith(cli.ExitRuntimeError)
		}
		return nil
	})
	selection.Register(command)
	command.Flags().BoolVar(&jsonOutput, jsonFlag, false, text.FlagJSON)
	return command
}

func newVouchersCommand(application *App) *cobra.Command {
	selection := cli.ProfileFlags{}
	jsonOutput := false
	help := text.HelpVouchers()
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, Long: help.Long,
		Example: help.Example, GroupID: text.GroupOperate, Args: cobra.NoArgs,
	}
	command.RunE = application.action(command, func(console *cli.Console) error {
		configuration, err := selection.Config()
		if err != nil {
			return err
		}
		result, err := admin.Vouchers(command.Context(), configuration)
		if err != nil {
			return err
		}
		if jsonOutput {
			return writeJSON(console.Out, result)
		}
		fmt.Fprintln(console.Out, view.Vouchers(console.Theme, result))
		return nil
	})
	selection.Register(command)
	command.Flags().BoolVar(&jsonOutput, jsonFlag, false, text.FlagJSON)
	return command
}
