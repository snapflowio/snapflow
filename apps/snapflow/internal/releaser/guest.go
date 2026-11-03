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
	"github.com/snapflowio/snapflow/internal/guestrelease"
	"github.com/spf13/cobra"
)

const defaultGuestPlatforms = "linux/amd64,linux/arm64"

func newGuestCommand(stdout io.Writer) *cobra.Command {
	config := guestrelease.PublishConfig{Platforms: defaultGuestPlatforms, Desktop: true}
	command := &cobra.Command{
		Use:   "guest",
		Short: "Publish an immutable multi-platform guest release index",
		Args:  cobra.NoArgs,
	}
	command.RunE = func(*cobra.Command, []string) error {
		result, err := guestrelease.Publish(command.Context(), config)
		if err != nil {
			return err
		}
		_, err = fmt.Fprintln(stdout, result.Reference)
		return err
	}
	command.Flags().StringVar(&config.Repository, "repository", "", "guest release OCI repository")
	command.Flags().StringVar(&config.Version, "version", "", "guest release version and output tag")
	command.Flags().StringVar(&config.Revision, "revision", "", "source revision")
	command.Flags().StringVar(&config.Platforms, "platforms", config.Platforms, "comma-separated OCI platforms")
	command.Flags().BoolVar(&config.Desktop, "desktop", config.Desktop, "include the desktop extension")
	command.Flags().BoolVar(&config.Insecure, "insecure", false, "allow plain HTTP for a development registry")
	command.Flags().StringVar(&config.MkfsErofs, "mkfs-erofs", "", "mkfs.erofs that builds the platform disk artifacts")
	cli.RequireFlags(command, "repository", "version", "revision", "mkfs-erofs")
	return command
}
