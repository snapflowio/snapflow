// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package local

import (
	"context"
	"fmt"
	"io"
	"path/filepath"

	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/system"
	"github.com/snapflowio/snapflow/internal/foundation/systemd"
	"github.com/snapflowio/snapflow/internal/supplychain/release"
)

const SystemFilesCommand = "system-files"

func InstallSystemFiles(ctx context.Context, commands CommandRunner, manager systemd.Manager, stdout, stderr io.Writer) error {
	return system.Install(ctx, system.Config{Commands: commands, Systemd: manager, Stdout: stdout, Stderr: stderr})
}

func SyncActiveSystemFiles(ctx context.Context, profile config.Profile, commands CommandRunner, log io.Writer) error {
	command := filepath.Join(profile.InstallationRoot, release.CurrentLinkName, filepath.FromSlash(release.CommandPath))
	if err := commands.Run(ctx, log, log, command, "release", SystemFilesCommand, "--profile", string(profile.Name)); err != nil {
		return fmt.Errorf("install the active release's system files: %w", err)
	}
	return nil
}
