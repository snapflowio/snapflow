// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package releaser

import (
	"fmt"
	"io"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/releaser/notices"
	"github.com/spf13/cobra"
)

func newNoticesCommand(stdout io.Writer) *cobra.Command {
	cfg := notices.Config{}
	command := &cobra.Command{
		Use:   "notices",
		Short: "Generate third-party notices for the Go modules linked into shipped binaries",
		Args:  cobra.NoArgs,
	}
	command.RunE = func(*cobra.Command, []string) error {
		if err := notices.Generate(command.Context(), cfg); err != nil {
			return err
		}
		_, err := fmt.Fprintln(stdout, "Wrote", cfg.Output)
		return err
	}
	command.Flags().StringVar(&cfg.WorkspaceRoot, "workspace-root", "", "Snapflow workspace root containing go.work")
	command.Flags().StringVar(&cfg.Template, "template", "", "notices template containing the Go modules placeholder")
	command.Flags().StringVar(&cfg.Output, "output", "", "generated third-party notices file")
	cli.RequireFlags(command, "workspace-root", "template", "output")
	return command
}
