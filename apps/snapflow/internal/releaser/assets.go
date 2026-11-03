// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package releaser

import (
	"encoding/json"
	"io"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/spf13/cobra"
)

func newFetchAssetsCommand(stdout io.Writer) *cobra.Command {
	architecture := ""
	output := ""
	command := &cobra.Command{
		Use:   "fetch-assets",
		Short: "Download and verify the pinned native runtime assets",
		Args:  cobra.NoArgs,
	}
	command.RunE = func(*cobra.Command, []string) error {
		paths, err := release.FetchAssets(command.Context(), architecture, output)
		if err != nil {
			return err
		}
		return json.NewEncoder(stdout).Encode(paths)
	}
	command.Flags().StringVar(&architecture, "architecture", "", "target Go architecture")
	command.Flags().StringVar(&output, "output", "", "verified asset output directory")
	cli.RequireFlags(command, "architecture", "output")
	return command
}
