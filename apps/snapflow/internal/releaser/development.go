// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package releaser

import (
	"encoding/json"
	"errors"
	"io"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/releaser/development"
	"github.com/spf13/cobra"
)

func newDevelopmentCommand(stdin io.Reader, stdout, stderr io.Writer) *cobra.Command {
	command := &cobra.Command{
		Use: "development", Short: "Prepare isolated unpublished development releases", Args: cobra.NoArgs,
	}
	command.AddCommand(newDevelopmentPrepareCommand(stdin, stdout, stderr))
	command.AddCommand(newDevelopmentResetCommand(stdin, stdout, stderr))
	return command
}

func newDevelopmentResetCommand(stdin io.Reader, stdout, stderr io.Writer) *cobra.Command {
	workspaceRoot := ""
	releaseStateHome := ""
	confirmation := ""
	command := &cobra.Command{
		Use: "reset", Short: "Remove isolated development release and signing state", Args: cobra.NoArgs,
	}
	command.RunE = func(*cobra.Command, []string) error {
		if confirmation != config.DevelopmentResetConfirmation {
			return errors.New("reset requires --confirm " + config.DevelopmentResetConfirmation)
		}
		result, err := development.Reset(command.Context(), development.ResetConfig{
			WorkspaceRoot: workspaceRoot, ReleaseStateHome: releaseStateHome,
			Stdout: stderr, Stderr: stderr, Stdin: stdin,
		})
		if err != nil {
			return err
		}
		return json.NewEncoder(stdout).Encode(result)
	}
	command.Flags().StringVar(&workspaceRoot, "workspace-root", "", "absolute Snapflow workspace root")
	command.Flags().StringVar(&releaseStateHome, "release-state-home", "", "absolute unprivileged development release state home")
	command.Flags().StringVar(&confirmation, "confirm", "", "required confirmation phrase")
	cli.RequireFlags(command, "workspace-root", "release-state-home")
	return command
}

func newDevelopmentPrepareCommand(stdin io.Reader, stdout, stderr io.Writer) *cobra.Command {
	workspaceRoot := ""
	releaseStateHome := ""
	version := ""
	command := &cobra.Command{
		Use: "prepare", Short: "Build, sign, install, and verify the current workspace", Args: cobra.NoArgs,
	}
	command.RunE = func(*cobra.Command, []string) error {
		result, err := development.Prepare(command.Context(), development.Config{
			WorkspaceRoot: workspaceRoot, ReleaseStateHome: releaseStateHome, Version: version,
			Stdout: stderr, Stderr: stderr, Stdin: stdin,
		})
		if err != nil {
			return err
		}
		return json.NewEncoder(stdout).Encode(result)
	}
	command.Flags().StringVar(&workspaceRoot, "workspace-root", "", "absolute Snapflow workspace root")
	command.Flags().StringVar(&releaseStateHome, "release-state-home", "", "absolute unprivileged development release state home")
	command.Flags().StringVar(&version, "version", "", "optional local release version")
	cli.RequireFlags(command, "workspace-root", "release-state-home")
	return command
}
