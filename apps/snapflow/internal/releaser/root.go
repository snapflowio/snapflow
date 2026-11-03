// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package releaser

import "github.com/spf13/cobra"

const (
	rootUse   = "snapflow-release"
	rootShort = "Build and publish trusted Snapflow releases"
)

func newRootCommand(tool *Tool) *cobra.Command {
	stdout, stderr := tool.cfg.Out, tool.cfg.Err
	command := &cobra.Command{
		Use:           rootUse,
		Short:         rootShort,
		Version:       tool.options.version,
		Args:          cobra.NoArgs,
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	command.SetIn(tool.cfg.In)
	command.SetOut(stdout)
	command.SetErr(stderr)
	command.AddCommand(
		newDevelopmentCommand(tool.cfg.In, stdout, stderr),
		newGuestCommand(stdout),
		newFetchAssetsCommand(stdout),
		newBundleCommand(stdout),
		newVerifyBundleCommand(),
		newTUFCommand(stdout),
		newNoticesCommand(stdout),
	)
	return command
}
